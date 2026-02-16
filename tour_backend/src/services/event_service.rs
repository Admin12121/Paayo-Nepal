use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::events::UpdateEventInput, models::post::Post,
    services::CacheService, utils::slug::generate_slug,
};

/// Maximum slug generation attempts before returning a conflict error.
const MAX_SLUG_RETRIES: usize = 5;

pub struct EventService {
    db: PgPool,
    cache: CacheService,
}

impl EventService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List events (posts with type='event')
    ///
    /// When `status` is `Some`, only events matching that status are returned.
    /// When `status` is `None`, events of any status are returned (used by
    /// privileged callers — the handler is responsible for passing
    /// `Some("published")` for public users).
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        region_id: Option<&str>,
        featured: Option<bool>,
        status: Option<&str>,
    ) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut where_clauses = vec![
            "type = 'event'".to_string(),
            "deleted_at IS NULL".to_string(),
        ];
        let mut param_idx: usize = 0;
        let mut bind_values: Vec<String> = Vec::new();

        if let Some(s) = status {
            param_idx += 1;
            where_clauses.push(format!("status = ${}::content_status", param_idx));
            bind_values.push(s.to_string());
        }

        if let Some(rid) = region_id {
            param_idx += 1;
            where_clauses.push(format!("region_id = ${}", param_idx));
            bind_values.push(rid.to_string());
        }

        if let Some(f) = featured {
            param_idx += 1;
            where_clauses.push(format!("is_featured = ${}", param_idx));
            bind_values.push(f.to_string());
        }

        let where_sql = where_clauses.join(" AND ");

        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;
        let data_sql = format!(
            "SELECT * FROM posts WHERE {} ORDER BY event_date ASC NULLS LAST LIMIT ${} OFFSET ${}",
            where_sql, limit_idx, offset_idx
        );
        let count_sql = format!("SELECT COUNT(*) FROM posts WHERE {}", where_sql);

        // Build and execute the data query
        let mut data_q = sqlx::query_as::<_, Post>(&data_sql);
        for b in &bind_values {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit as i64).bind(offset as i64);
        let events: Vec<Post> = data_q.fetch_all(&self.db).await?;

        // Build and execute the count query
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &bind_values {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((events, total.0))
    }

    /// Get upcoming events (event_date >= today)
    pub async fn upcoming(&self, page: i32, limit: i32) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let events: Vec<Post> = sqlx::query_as(
            r#"
            SELECT * FROM posts
            WHERE type = 'event'
              AND event_date >= CURRENT_DATE
              AND deleted_at IS NULL
              AND status = 'published'
            ORDER BY event_date ASC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM posts
            WHERE type = 'event'
              AND event_date >= CURRENT_DATE
              AND deleted_at IS NULL
              AND status = 'published'
            "#,
        )
        .fetch_one(&self.db)
        .await?;

        Ok((events, total.0))
    }

    /// Get past events (event_date < today)
    pub async fn past(&self, page: i32, limit: i32) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let events: Vec<Post> = sqlx::query_as(
            r#"
            SELECT * FROM posts
            WHERE type = 'event'
              AND event_date < CURRENT_DATE
              AND deleted_at IS NULL
              AND status = 'published'
            ORDER BY event_date DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM posts
            WHERE type = 'event'
              AND event_date < CURRENT_DATE
              AND deleted_at IS NULL
              AND status = 'published'
            "#,
        )
        .fetch_one(&self.db)
        .await?;

        Ok((events, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Post>, ApiError> {
        let event = sqlx::query_as::<_, Post>(
            "SELECT * FROM posts WHERE type = 'event' AND slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(event)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Post>, ApiError> {
        let event = sqlx::query_as::<_, Post>(
            "SELECT * FROM posts WHERE type = 'event' AND id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(event)
    }

    pub async fn create(
        &self,
        author_id: &str,
        title: &str,
        short_description: Option<&str>,
        content: Option<&str>,
        cover_image: Option<&str>,
        event_date: Option<&str>,
        event_end_date: Option<&str>,
        region_id: Option<&str>,
        is_featured: bool,
    ) -> Result<Post, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);

        sqlx::query(
            r#"
            INSERT INTO posts (
                id, type, author_id, title, slug, short_description,
                content, cover_image, event_date, event_end_date,
                region_id, is_featured, status,
                like_count, view_count, created_at, updated_at
            )
            VALUES (
                $1, 'event', $2, $3, $4, $5,
                $6::jsonb, $7, $8::timestamptz, $9::timestamptz,
                $10, $11, 'draft',
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
        .bind(event_date)
        .bind(event_end_date)
        .bind(region_id)
        .bind(is_featured)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("events:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateEventInput) -> Result<Post, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Event not found".to_string()))?;

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
                    "Slug collision on event update attempt {} for title '{}', slug '{}'. Retrying...",
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
                event_date = COALESCE($6::timestamptz, event_date),
                event_end_date = COALESCE($7::timestamptz, event_end_date),
                region_id = COALESCE($8, region_id),
                is_featured = COALESCE($9, is_featured),
                status = COALESCE($10::content_status, status)
            WHERE id = $11 AND type = 'event' AND deleted_at IS NULL
            "#,
        )
        .bind(new_slug.as_deref())
        .bind(&input.title)
        .bind(&input.short_description)
        .bind(&input.content)
        .bind(&input.cover_image)
        .bind(&input.event_date)
        .bind(&input.event_end_date)
        .bind(&input.region_id)
        .bind(input.is_featured)
        .bind(&input.status)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("events:*").await;
        let _ = self
            .cache
            .delete(&format!("event:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        // Soft delete
        sqlx::query(
            "UPDATE posts SET deleted_at = NOW() WHERE id = $1 AND type = 'event' AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("events:*").await;
        if let Some(event) = existing {
            let _ = self
                .cache
                .delete(&format!("event:slug:{}", event.slug))
                .await;
        }

        Ok(())
    }
}
