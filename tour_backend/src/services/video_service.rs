use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError, models::video::Video, services::CacheService, utils::slug::generate_slug,
};

/// Maximum slug generation attempts before returning a conflict error.
const MAX_SLUG_RETRIES: usize = 5;

pub struct VideoService {
    db: PgPool,
    cache: CacheService,
}

impl VideoService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List videos with optional filters. Always excludes soft-deleted videos.
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        status: Option<&str>,
        region_id: Option<&str>,
        platform: Option<&str>,
        is_featured: Option<bool>,
    ) -> Result<(Vec<Video>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut where_clauses = vec!["deleted_at IS NULL".to_string()];
        let mut param_idx: usize = 0;
        let mut bind_values: Vec<String> = Vec::new();

        if let Some(s) = status {
            param_idx += 1;
            where_clauses.push(format!("status = ${}::content_status", param_idx));
            bind_values.push(s.to_string());
        }

        if let Some(r) = region_id {
            param_idx += 1;
            where_clauses.push(format!("region_id = ${}", param_idx));
            bind_values.push(r.to_string());
        }

        if let Some(p) = platform {
            param_idx += 1;
            where_clauses.push(format!("platform = ${}::video_platform", param_idx));
            bind_values.push(p.to_string());
        }

        if let Some(f) = is_featured {
            param_idx += 1;
            where_clauses.push(format!("is_featured = ${}", param_idx));
            bind_values.push(f.to_string());
        }

        let where_sql = where_clauses.join(" AND ");

        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;
        let data_sql = format!(
            "SELECT * FROM videos WHERE {} ORDER BY is_featured DESC, display_order ASC NULLS LAST, published_at DESC NULLS LAST, created_at DESC LIMIT ${} OFFSET ${}",
            where_sql, limit_idx, offset_idx
        );
        let count_sql = format!("SELECT COUNT(*) FROM videos WHERE {}", where_sql);

        let mut data_q = sqlx::query_as::<_, Video>(&data_sql);
        for b in &bind_values {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit as i64).bind(offset as i64);
        let videos: Vec<Video> = data_q.fetch_all(&self.db).await?;

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &bind_values {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((videos, total.0))
    }

    /// Get a video by slug. Excludes soft-deleted videos.
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Video>, ApiError> {
        let video = sqlx::query_as::<_, Video>(
            "SELECT * FROM videos WHERE slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(video)
    }

    /// Get a video by ID. Excludes soft-deleted videos.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<Video>, ApiError> {
        let video =
            sqlx::query_as::<_, Video>("SELECT * FROM videos WHERE id = $1 AND deleted_at IS NULL")
                .bind(id)
                .fetch_optional(&self.db)
                .await?;

        Ok(video)
    }

    /// Create a new video.
    pub async fn create(
        &self,
        author_id: &str,
        title: &str,
        description: Option<&str>,
        platform: &str,
        video_url: &str,
        video_id: Option<&str>,
        thumbnail_url: Option<&str>,
        duration: Option<i32>,
        region_id: Option<&str>,
        is_featured: bool,
    ) -> Result<Video, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);

        sqlx::query(
            r#"
            INSERT INTO videos (
                id, author_id, title, slug, description,
                platform, video_url, video_id, thumbnail_url, duration,
                region_id, is_featured, status,
                like_count, view_count, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6::video_platform, $7, $8, $9, $10,
                $11, $12, 'draft',
                0, 0, NOW(), NOW()
            )
            "#,
        )
        .bind(&id)
        .bind(author_id)
        .bind(title)
        .bind(&slug)
        .bind(description)
        .bind(platform)
        .bind(video_url)
        .bind(video_id)
        .bind(thumbnail_url)
        .bind(duration)
        .bind(region_id)
        .bind(is_featured)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("videos:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update an existing video. Only updates provided (non-None) fields.
    pub async fn update(
        &self,
        id: &str,
        title: Option<&str>,
        description: Option<&str>,
        video_url: Option<&str>,
        video_id: Option<&str>,
        thumbnail_url: Option<&str>,
        duration: Option<i32>,
        region_id: Option<&str>,
        is_featured: Option<bool>,
        status: Option<&str>,
    ) -> Result<Video, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))?;

        // Generate a unique slug when title changes, with collision retry loop.
        let new_slug = if let Some(t) = title {
            let mut slug_candidate = generate_slug(t);
            let mut found_unique = false;

            for attempt in 0..MAX_SLUG_RETRIES {
                let conflict = sqlx::query_as::<_, (i64,)>(
                    "SELECT COUNT(*) FROM videos WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
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
                    "Slug collision on video update attempt {} for title '{}', slug '{}'. Retrying...",
                    attempt + 1,
                    t,
                    slug_candidate,
                );
                slug_candidate = generate_slug(t);
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
            UPDATE videos SET
                slug = COALESCE($1, slug),
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                video_url = COALESCE($4, video_url),
                video_id = COALESCE($5, video_id),
                thumbnail_url = COALESCE($6, thumbnail_url),
                duration = COALESCE($7, duration),
                region_id = CASE
                    WHEN $8 IS NULL THEN region_id
                    WHEN $8 = '' THEN NULL
                    ELSE $8
                END,
                is_featured = COALESCE($9, is_featured),
                status = COALESCE($10::content_status, status)
            WHERE id = $11 AND deleted_at IS NULL
            "#,
        )
        .bind(new_slug.as_deref())
        .bind(title)
        .bind(description)
        .bind(video_url)
        .bind(video_id)
        .bind(thumbnail_url)
        .bind(duration)
        .bind(region_id)
        .bind(is_featured)
        .bind(status)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("videos:*").await;
        let _ = self
            .cache
            .delete(&format!("video:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update the status of a video (draft/published).
    /// Sets published_at on first publish.
    pub async fn update_status(&self, id: &str, status: &str) -> Result<Video, ApiError> {
        let published_at = if status == "published" {
            Some(chrono::Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE videos SET
                status = $1::content_status,
                published_at = COALESCE($2, published_at)
            WHERE id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(status)
        .bind(published_at)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("videos:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))
    }

    /// Soft delete a video.
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("UPDATE videos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("videos:*").await;
        if let Some(video) = existing {
            let _ = self
                .cache
                .delete(&format!("video:slug:{}", video.slug))
                .await;
        }

        Ok(())
    }

    /// Restore a soft-deleted video.
    pub async fn restore(&self, id: &str) -> Result<Video, ApiError> {
        sqlx::query("UPDATE videos SET deleted_at = NULL WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("videos:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))
    }

    /// Update display order for a video (admin).
    pub async fn update_display_order(
        &self,
        id: &str,
        display_order: Option<i32>,
    ) -> Result<Video, ApiError> {
        sqlx::query("UPDATE videos SET display_order = $1 WHERE id = $2 AND deleted_at IS NULL")
            .bind(display_order)
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("videos:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))
    }

    /// Extract the YouTube video ID from a URL.
    /// Supports formats like:
    /// - https://www.youtube.com/watch?v=VIDEO_ID
    /// - https://youtu.be/VIDEO_ID
    /// - https://www.youtube.com/embed/VIDEO_ID
    pub fn extract_youtube_id(url: &str) -> Option<String> {
        if url.contains("youtu.be/") {
            url.split("youtu.be/")
                .nth(1)
                .map(|s| s.split('?').next().unwrap_or(s))
                .map(|s| s.to_string())
        } else if url.contains("youtube.com/watch") {
            url.split("v=")
                .nth(1)
                .map(|s| s.split('&').next().unwrap_or(s))
                .map(|s| s.to_string())
        } else if url.contains("youtube.com/embed/") {
            url.split("embed/")
                .nth(1)
                .map(|s| s.split('?').next().unwrap_or(s))
                .map(|s| s.to_string())
        } else {
            None
        }
    }

    /// Generate a YouTube thumbnail URL from a video ID.
    pub fn youtube_thumbnail_url(video_id: &str) -> String {
        format!("https://img.youtube.com/vi/{}/maxresdefault.jpg", video_id)
    }

    /// List soft-deleted videos (for admin trash view).
    pub async fn list_deleted(&self, page: i32, limit: i32) -> Result<(Vec<Video>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let videos: Vec<Video> = sqlx::query_as(
            r#"
            SELECT * FROM videos
            WHERE deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM videos WHERE deleted_at IS NOT NULL")
                .fetch_one(&self.db)
                .await?;

        Ok((videos, total.0))
    }

    /// Hard delete a video permanently (admin only, for trash cleanup).
    pub async fn hard_delete(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM videos WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("videos:*").await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_youtube_id_watch_url() {
        let url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        assert_eq!(
            VideoService::extract_youtube_id(url),
            Some("dQw4w9WgXcQ".to_string())
        );
    }

    #[test]
    fn test_extract_youtube_id_short_url() {
        let url = "https://youtu.be/dQw4w9WgXcQ";
        assert_eq!(
            VideoService::extract_youtube_id(url),
            Some("dQw4w9WgXcQ".to_string())
        );
    }

    #[test]
    fn test_extract_youtube_id_embed_url() {
        let url = "https://www.youtube.com/embed/dQw4w9WgXcQ";
        assert_eq!(
            VideoService::extract_youtube_id(url),
            Some("dQw4w9WgXcQ".to_string())
        );
    }

    #[test]
    fn test_extract_youtube_id_with_params() {
        let url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s";
        assert_eq!(
            VideoService::extract_youtube_id(url),
            Some("dQw4w9WgXcQ".to_string())
        );
    }

    #[test]
    fn test_extract_youtube_id_invalid() {
        let url = "https://vimeo.com/123456789";
        assert_eq!(VideoService::extract_youtube_id(url), None);
    }

    #[test]
    fn test_youtube_thumbnail_url() {
        let thumb = VideoService::youtube_thumbnail_url("dQw4w9WgXcQ");
        assert_eq!(
            thumb,
            "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
        );
    }
}
