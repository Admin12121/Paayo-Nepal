use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::ApiError, models::media::Media, services::CacheService};

pub struct MediaService {
    db: PgPool,
    cache: CacheService,
}

impl MediaService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        media_type: Option<&str>,
    ) -> Result<(Vec<Media>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let media: Vec<Media> = if let Some(mt) = media_type {
            sqlx::query_as(
                r#"
                SELECT * FROM media
                WHERE type = $1::media_type
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(mt)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT * FROM media
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(mt) = media_type {
            sqlx::query_as("SELECT COUNT(*) FROM media WHERE type = $1::media_type")
                .bind(mt)
                .fetch_one(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM media")
                .fetch_one(&self.db)
                .await?
        };

        Ok((media, total.0))
    }

    /// Gallery view: only images, ordered by newest.
    pub async fn gallery(
        &self,
        page: i32,
        limit: i32,
        _featured: Option<bool>,
    ) -> Result<(Vec<Media>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let media: Vec<Media> = sqlx::query_as(
            r#"
            SELECT * FROM media
            WHERE type = 'image'
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM media WHERE type = 'image'")
            .fetch_one(&self.db)
            .await?;

        Ok((media, total.0))
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Media>, ApiError> {
        let media = sqlx::query_as::<_, Media>("SELECT * FROM media WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(media)
    }

    /// Create a new media record after image processing.
    pub async fn create(
        &self,
        filename: &str,
        original_name: &str,
        mime_type: &str,
        size: i32,
        width: i32,
        height: i32,
        blur_hash: &str,
        thumbnail_path: &str,
        uploaded_by: &str,
    ) -> Result<Media, ApiError> {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO media (
                id, filename, original_name, mime_type, size, type,
                width, height, blur_hash, thumbnail_path, uploaded_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, 'image', $6, $7, $8, $9, $10, NOW())
            "#,
        )
        .bind(&id)
        .bind(filename)
        .bind(original_name)
        .bind(mime_type)
        .bind(size)
        .bind(width)
        .bind(height)
        .bind(blur_hash)
        .bind(thumbnail_path)
        .bind(uploaded_by)
        .execute(&self.db)
        .await?;

        // Invalidate gallery cache
        let _ = self.cache.invalidate("gallery:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update alt text and caption for a media item.
    pub async fn update_metadata(
        &self,
        id: &str,
        alt: Option<&str>,
        caption: Option<&str>,
    ) -> Result<Media, ApiError> {
        sqlx::query(
            r#"
            UPDATE media SET
                alt = COALESCE($1, alt),
                caption = COALESCE($2, caption)
            WHERE id = $3
            "#,
        )
        .bind(alt)
        .bind(caption)
        .bind(id)
        .execute(&self.db)
        .await?;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Media not found".to_string()))
    }

    /// Delete a media record from the database.
    /// File deletion should be handled separately by the caller.
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM media WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("gallery:*").await;

        Ok(())
    }

    /// List media uploaded by a specific user.
    pub async fn list_by_user(
        &self,
        user_id: &str,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<Media>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let media: Vec<Media> = sqlx::query_as(
            r#"
            SELECT * FROM media
            WHERE uploaded_by = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM media WHERE uploaded_by = $1")
            .bind(user_id)
            .fetch_one(&self.db)
            .await?;

        Ok((media, total.0))
    }

    /// Count total media items (for admin dashboard).
    pub async fn count_total(&self) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM media")
            .fetch_one(&self.db)
            .await?;
        Ok(count)
    }
}
