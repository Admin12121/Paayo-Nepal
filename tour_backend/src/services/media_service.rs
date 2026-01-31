use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{error::ApiError, models::media::Media, services::CacheService};

pub struct MediaService {
    db: MySqlPool,
    cache: CacheService,
}

impl MediaService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
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
                "SELECT * FROM media WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )
            .bind(mt)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as("SELECT * FROM media ORDER BY created_at DESC LIMIT ? OFFSET ?")
                .bind(limit)
                .bind(offset)
                .fetch_all(&self.db)
                .await?
        };

        let total: (i64,) = if let Some(mt) = media_type {
            sqlx::query_as("SELECT COUNT(*) FROM media WHERE type = ?")
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

    pub async fn gallery(
        &self,
        page: i32,
        limit: i32,
        featured: Option<bool>,
    ) -> Result<(Vec<Media>, i64), ApiError> {
        let offset = (page - 1) * limit;

        // Gallery only shows images
        let media: Vec<Media> = sqlx::query_as(
            "SELECT * FROM media WHERE type = 'image' ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM media WHERE type = 'image'")
            .fetch_one(&self.db)
            .await?;

        Ok((media, total.0))
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Media>, ApiError> {
        let media = sqlx::query_as::<_, Media>("SELECT * FROM media WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(media)
    }

    pub async fn create(
        &self,
        filename: &str,
        original_name: &str,
        mime_type: &str,
        size: i64,
        width: i32,
        height: i32,
        blur_hash: &str,
        thumbnail_path: &str,
        uploaded_by: &str,
    ) -> Result<Media, ApiError> {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO media (id, filename, original_name, mime_type, size, type, width, height, blur_hash, thumbnail_path, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, 'image', ?, ?, ?, ?, ?, NOW())
            "#
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
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM media WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("gallery:*").await;

        Ok(())
    }
}
