use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::attractions::UpdateAttractionInput, models::post::Post,
    services::CacheService, utils::slug::generate_slug,
};

pub struct AttractionService {
    db: PgPool,
    cache: CacheService,
}

impl AttractionService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List attractions (posts with type='explore')
    ///
    /// When `status` is `Some`, only attractions matching that status are returned.
    /// When `status` is `None`, attractions of any status are returned (used by
    /// privileged callers — the handler is responsible for passing
    /// `Some("published")` for public users).
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        region_id: Option<&str>,
        is_featured: Option<bool>,
        status: Option<&str>,
    ) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut where_clauses = vec![
            "type = 'explore'".to_string(),
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
            where_clauses.push(format!("region_id::text = ${}", param_idx));
            bind_values.push(rid.to_string());
        }

        if let Some(f) = is_featured {
            param_idx += 1;
            where_clauses.push(format!("is_featured = ${}::boolean", param_idx));
            bind_values.push(f.to_string());
        }

        let where_sql = where_clauses.join(" AND ");

        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;
        let data_sql = format!(
            "SELECT * FROM posts WHERE {} ORDER BY is_featured DESC, like_count DESC LIMIT ${} OFFSET ${}",
            where_sql, limit_idx, offset_idx
        );
        let count_sql = format!("SELECT COUNT(*) FROM posts WHERE {}", where_sql);

        let mut data_q = sqlx::query_as::<_, Post>(&data_sql);
        for b in &bind_values {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit as i64).bind(offset as i64);
        let attractions: Vec<Post> = data_q.fetch_all(&self.db).await?;

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &bind_values {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((attractions, total.0))
    }

    /// Get top/featured attractions
    pub async fn top(&self, page: i32, limit: i32) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let attractions: Vec<Post> = sqlx::query_as(
            r#"
            SELECT * FROM posts
            WHERE type = 'explore'
              AND is_featured = true
              AND deleted_at IS NULL
              AND status = 'published'
            ORDER BY like_count DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM posts WHERE type = 'explore' AND is_featured = true AND deleted_at IS NULL AND status = 'published'",
        )
        .fetch_one(&self.db)
        .await?;

        Ok((attractions, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Post>, ApiError> {
        let attraction = sqlx::query_as::<_, Post>(
            "SELECT * FROM posts WHERE type = 'explore' AND slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(attraction)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Post>, ApiError> {
        let attraction = sqlx::query_as::<_, Post>(
            "SELECT * FROM posts WHERE type = 'explore' AND id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(attraction)
    }

    pub async fn create(
        &self,
        author_id: &str,
        title: &str,
        short_description: Option<&str>,
        content: Option<&str>,
        cover_image: Option<&str>,
        region_id: Option<&str>,
        is_featured: bool,
    ) -> Result<Post, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);

        sqlx::query(
            r#"
            INSERT INTO posts (
                id, type, author_id, title, slug, short_description,
                content, cover_image, region_id, is_featured, status,
                like_count, view_count, created_at, updated_at
            )
            VALUES (
                $1, 'explore', $2, $3, $4, $5,
                $6::jsonb, $7, $8, $9, 'draft',
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
        .bind(region_id)
        .bind(is_featured)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("attractions:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateAttractionInput) -> Result<Post, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Attraction not found".to_string()))?;

        sqlx::query(
            r#"
            UPDATE posts SET
                title = COALESCE($1, title),
                short_description = COALESCE($2, short_description),
                content = COALESCE($3::jsonb, content),
                cover_image = COALESCE($4, cover_image),
                region_id = COALESCE($5, region_id),
                is_featured = COALESCE($6, is_featured),
                status = COALESCE($7::content_status, status)
            WHERE id = $8 AND type = 'explore' AND deleted_at IS NULL
            "#,
        )
        .bind(&input.title)
        .bind(&input.short_description)
        .bind(&input.content)
        .bind(&input.cover_image)
        .bind(&input.region_id)
        .bind(input.is_featured)
        .bind(&input.status)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("attractions:*").await;
        let _ = self
            .cache
            .delete(&format!("attraction:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        // Soft delete
        sqlx::query(
            "UPDATE posts SET deleted_at = NOW() WHERE id = $1 AND type = 'explore' AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("attractions:*").await;
        if let Some(attraction) = existing {
            let _ = self
                .cache
                .delete(&format!("attraction:slug:{}", attraction.slug))
                .await;
        }

        Ok(())
    }
}
