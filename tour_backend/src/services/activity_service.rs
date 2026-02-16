use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::activities::UpdateActivityInput, models::post::Post,
    services::CacheService, utils::slug::generate_slug,
};

/// Maximum slug generation attempts before returning a conflict error.
const MAX_SLUG_RETRIES: usize = 5;

pub struct ActivityService {
    db: PgPool,
    cache: CacheService,
}

impl ActivityService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List activities (posts with type='activity')
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        is_active: Option<bool>,
    ) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        // is_active maps to status='published'
        let activities: Vec<Post> = if let Some(active) = is_active {
            let status = if active { "published" } else { "draft" };
            sqlx::query_as(
                r#"
                SELECT * FROM posts
                WHERE type = 'activity'
                  AND status = $1::content_status
                  AND deleted_at IS NULL
                ORDER BY display_order ASC NULLS LAST, title ASC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(status)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT * FROM posts
                WHERE type = 'activity'
                  AND deleted_at IS NULL
                ORDER BY display_order ASC NULLS LAST, title ASC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(active) = is_active {
            let status = if active { "published" } else { "draft" };
            sqlx::query_as(
                "SELECT COUNT(*) FROM posts WHERE type = 'activity' AND status = $1::content_status AND deleted_at IS NULL",
            )
            .bind(status)
            .fetch_one(&self.db)
            .await?
        } else {
            sqlx::query_as(
                "SELECT COUNT(*) FROM posts WHERE type = 'activity' AND deleted_at IS NULL",
            )
            .fetch_one(&self.db)
            .await?
        };

        Ok((activities, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Post>, ApiError> {
        let activity = sqlx::query_as::<_, Post>(
            "SELECT * FROM posts WHERE type = 'activity' AND slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(activity)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Post>, ApiError> {
        let activity = sqlx::query_as::<_, Post>(
            "SELECT * FROM posts WHERE type = 'activity' AND id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(activity)
    }

    pub async fn create(
        &self,
        author_id: &str,
        title: &str,
        short_description: Option<&str>,
        content: Option<&str>,
        cover_image: Option<&str>,
        is_featured: bool,
    ) -> Result<Post, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);

        sqlx::query(
            r#"
            INSERT INTO posts (
                id, type, author_id, title, slug, short_description,
                content, cover_image, is_featured, status,
                like_count, view_count, created_at, updated_at
            )
            VALUES (
                $1, 'activity', $2, $3, $4, $5,
                $6::jsonb, $7, $8, 'draft',
                0, 0, NOW(), NOW()
            )
            "#,
        )
        .bind(&id)
        .bind(author_id)
        .bind(title)
        .bind(&slug)
        .bind(short_description)
        .bind(content)
        .bind(cover_image)
        .bind(is_featured)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("activities:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateActivityInput) -> Result<Post, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Activity not found".to_string()))?;

        // Generate a unique slug when title changes, with collision retry loop.
        let new_slug = if let Some(ref title) = input.title {
            let mut slug_candidate = generate_slug(title);
            let mut found_unique = false;

            for attempt in 0..MAX_SLUG_RETRIES {
                let conflict = sqlx::query_as::<_, (i64,)>(
                    "SELECT COUNT(*) FROM posts WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
                )
                .bind(&slug_candidate)
                .bind(id)
                .fetch_one(&self.db)
                .await?;

                if conflict.0 == 0 {
                    found_unique = true;
                    break;
                }

                tracing::warn!(
                    "Slug collision on activity update attempt {} for title '{}', slug '{}'. Retrying...",
                    attempt + 1,
                    title,
                    slug_candidate,
                );
                slug_candidate = generate_slug(title);
            }

            if !found_unique {
                return Err(ApiError::Conflict(format!(
                    "Could not generate a unique slug after {} attempts",
                    MAX_SLUG_RETRIES
                )));
            }

            Some(slug_candidate)
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE posts SET
                slug = COALESCE($1, slug),
                title = COALESCE($2, title),
                short_description = COALESCE($3, short_description),
                content = COALESCE($4::jsonb, content),
                cover_image = COALESCE($5, cover_image),
                is_featured = COALESCE($6, is_featured),
                status = COALESCE($7::content_status, status)
            WHERE id = $8 AND type = 'activity' AND deleted_at IS NULL
            "#,
        )
        .bind(new_slug.as_deref())
        .bind(&input.title)
        .bind(&input.short_description)
        .bind(&input.content)
        .bind(&input.cover_image)
        .bind(input.is_featured)
        .bind(&input.status)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("activities:*").await;
        let _ = self
            .cache
            .delete(&format!("activity:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        // Soft delete
        sqlx::query(
            "UPDATE posts SET deleted_at = NOW() WHERE id = $1 AND type = 'activity' AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("activities:*").await;
        if let Some(activity) = existing {
            let _ = self
                .cache
                .delete(&format!("activity:slug:{}", activity.slug))
                .await;
        }

        Ok(())
    }
}
