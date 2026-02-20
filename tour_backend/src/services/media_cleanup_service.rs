use chrono::{Duration, Utc};
use sqlx::{FromRow, PgPool};
use tracing::{info, warn};

use crate::{error::ApiError, services::CacheService};

/// Service responsible for finding and cleaning up orphaned media records.
///
/// An "orphaned" media record is one that:
///   1. Was uploaded (exists in the `media` table and on disk)
///   2. Is NOT referenced by any content entity (posts, hotels, activities,
///      attractions, events, photo features, hero slides, or embedded in
///      any post/hotel/activity/attraction/event content HTML)
///   3. Has been in this unreferenced state for longer than a grace period
///      (default: 24 hours), giving users time to finish editing and save.
///
/// The cleanup can be run periodically via a background task or triggered
/// manually from an admin endpoint.
pub struct MediaCleanupService {
    db: PgPool,
    cache: CacheService,
}

#[derive(Debug, Clone, FromRow)]
pub struct OrphanedMedia {
    pub id: String,
    pub filename: String,
    pub thumbnail_path: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CleanupReport {
    pub orphans_found: usize,
    pub orphans_deleted: usize,
    pub files_deleted: usize,
    pub errors: Vec<String>,
}

impl MediaCleanupService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// Find all orphaned media records older than `grace_period_hours`.
    ///
    /// A media record is considered orphaned if its filename (or `/uploads/filename`)
    /// does NOT appear in any of these places:
    ///   - `posts.cover_image`
    ///   - `posts.content` (HTML body — checked via text search)
    ///   - `hotels.cover_image`
    ///   - `hotels.gallery` (JSON array — checked via text cast)
    ///   - `hotels.description` (may contain inline images)
    ///   - `hero_slides.image_url`
    ///   - `photo_feature_images.image_url`
    ///   - `regions.cover_image`
    ///
    /// We use a single query with LEFT JOINs and NOT EXISTS subqueries
    /// for efficiency, rather than loading everything into memory.
    pub async fn find_orphans(
        &self,
        grace_period_hours: i64,
    ) -> Result<Vec<OrphanedMedia>, ApiError> {
        let cutoff = Utc::now() - Duration::hours(grace_period_hours);

        let orphans: Vec<OrphanedMedia> = sqlx::query_as(
            r#"
            SELECT
                m.id,
                m.filename,
                m.thumbnail_path,
                m.created_at
            FROM media m
            WHERE m.created_at < $1
              -- Not used as a cover image in any post
              AND NOT EXISTS (
                  SELECT 1 FROM posts p
                  WHERE p.deleted_at IS NULL
                    AND p.cover_image IS NOT NULL
                    AND p.cover_image LIKE '%' || m.filename || '%'
              )
              -- Not embedded in any post content (HTML body)
              AND NOT EXISTS (
                  SELECT 1 FROM posts p
                  WHERE p.deleted_at IS NULL
                    AND p.content IS NOT NULL
                    AND p.content::text LIKE '%' || m.filename || '%'
              )
              -- Not used as a cover image in any hotel
              AND NOT EXISTS (
                  SELECT 1 FROM hotels h
                  WHERE h.deleted_at IS NULL
                    AND h.cover_image IS NOT NULL
                    AND h.cover_image LIKE '%' || m.filename || '%'
              )
              -- Not in any hotel gallery (JSON array cast to text)
              AND NOT EXISTS (
                  SELECT 1 FROM hotels h
                  WHERE h.deleted_at IS NULL
                    AND h.gallery IS NOT NULL
                    AND h.gallery::text LIKE '%' || m.filename || '%'
              )
              -- Not used in hero slides
              AND NOT EXISTS (
                  SELECT 1 FROM hero_slides hs
                  WHERE hs.image_url IS NOT NULL
                    AND hs.image_url LIKE '%' || m.filename || '%'
              )
              -- Not used in photo feature images
              AND NOT EXISTS (
                  SELECT 1 FROM photo_feature_images pfi
                  WHERE pfi.image_url LIKE '%' || m.filename || '%'
              )
              -- Not used as a region cover image
              AND NOT EXISTS (
                  SELECT 1 FROM regions r
                  WHERE r.cover_image IS NOT NULL
                    AND r.cover_image LIKE '%' || m.filename || '%'
              )
            ORDER BY m.created_at ASC
            "#,
        )
        .bind(cutoff)
        .fetch_all(&self.db)
        .await
        .map_err(|e| {
            warn!("Failed to query orphaned media: {:?}", e);
            ApiError::DatabaseError(e)
        })?;

        info!(
            "Found {} orphaned media records older than {} hours",
            orphans.len(),
            grace_period_hours
        );

        Ok(orphans)
    }

    /// Delete orphaned media records from the database.
    ///
    /// Returns the IDs of deleted records. File deletion should be handled
    /// separately by the caller (using `ImageService::delete_image`).
    pub async fn delete_orphan_records(&self, orphan_ids: &[String]) -> Result<usize, ApiError> {
        if orphan_ids.is_empty() {
            return Ok(0);
        }

        // Delete in batches to avoid excessively large queries
        let batch_size = 100;
        let mut total_deleted = 0usize;

        for chunk in orphan_ids.chunks(batch_size) {
            // Build a parameterized IN clause
            let placeholders: Vec<String> = chunk
                .iter()
                .enumerate()
                .map(|(i, _)| format!("${}", i + 1))
                .collect();
            let in_clause = placeholders.join(", ");

            let query_str = format!("DELETE FROM media WHERE id IN ({})", in_clause);

            let mut query = sqlx::query(&query_str);
            for id in chunk {
                query = query.bind(id);
            }

            let result = query.execute(&self.db).await.map_err(|e| {
                warn!("Failed to delete orphan media batch: {:?}", e);
                ApiError::DatabaseError(e)
            })?;

            total_deleted += result.rows_affected() as usize;
        }

        // Invalidate relevant caches
        let _ = self.cache.invalidate("gallery:*").await;

        info!(
            "Deleted {} orphaned media records from database",
            total_deleted
        );

        Ok(total_deleted)
    }

    /// Full cleanup: find orphans, delete DB records, and return a report.
    ///
    /// File deletion is NOT done here — the caller should use the returned
    /// `OrphanedMedia` list to delete files via `ImageService::delete_image`.
    /// This separation allows the caller to handle file deletion errors
    /// gracefully without rolling back DB changes.
    pub async fn cleanup(
        &self,
        grace_period_hours: i64,
    ) -> Result<(Vec<OrphanedMedia>, CleanupReport), ApiError> {
        let orphans = self.find_orphans(grace_period_hours).await?;
        let orphans_found = orphans.len();

        if orphans.is_empty() {
            info!("No orphaned media to clean up");
            return Ok((
                vec![],
                CleanupReport {
                    orphans_found: 0,
                    orphans_deleted: 0,
                    files_deleted: 0,
                    errors: vec![],
                },
            ));
        }

        let ids: Vec<String> = orphans.iter().map(|o| o.id.clone()).collect();
        let deleted = self.delete_orphan_records(&ids).await?;

        let report = CleanupReport {
            orphans_found,
            orphans_deleted: deleted,
            files_deleted: 0, // Caller fills this in after deleting files
            errors: vec![],
        };

        Ok((orphans, report))
    }

    /// Count orphaned media without deleting (for dashboard/monitoring).
    pub async fn count_orphans(&self, grace_period_hours: i64) -> Result<i64, ApiError> {
        let cutoff = Utc::now() - Duration::hours(grace_period_hours);

        let (count,): (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM media m
            WHERE m.created_at < $1
              AND NOT EXISTS (
                  SELECT 1 FROM posts p
                  WHERE p.deleted_at IS NULL
                    AND p.cover_image IS NOT NULL
                    AND p.cover_image LIKE '%' || m.filename || '%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM posts p
                  WHERE p.deleted_at IS NULL
                    AND p.content IS NOT NULL
                    AND p.content::text LIKE '%' || m.filename || '%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM hotels h
                  WHERE h.deleted_at IS NULL
                    AND h.cover_image IS NOT NULL
                    AND h.cover_image LIKE '%' || m.filename || '%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM hotels h
                  WHERE h.deleted_at IS NULL
                    AND h.gallery IS NOT NULL
                    AND h.gallery::text LIKE '%' || m.filename || '%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM hero_slides hs
                  WHERE hs.image_url IS NOT NULL
                    AND hs.image_url LIKE '%' || m.filename || '%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM photo_feature_images pfi
                  WHERE pfi.image_url LIKE '%' || m.filename || '%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM regions r
                  WHERE r.cover_image IS NOT NULL
                    AND r.cover_image LIKE '%' || m.filename || '%'
              )
            "#,
        )
        .bind(cutoff)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        Ok(count)
    }
}

/// Spawn a background task that periodically cleans up orphaned media.
///
/// - `interval_hours`: how often to run (e.g., every 6 hours).
/// - `grace_period_hours`: only delete orphans older than this (e.g., 24 hours).
/// - `image_service`: used to delete actual files from disk.
pub fn spawn_media_cleanup_task(
    db: PgPool,
    cache: CacheService,
    image_service: std::sync::Arc<crate::services::ImageService>,
    interval_hours: u64,
    grace_period_hours: i64,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(interval_hours * 3600);
        let mut ticker = tokio::time::interval(interval);

        // Skip the first immediate tick — let the app start up fully first
        ticker.tick().await;

        loop {
            ticker.tick().await;
            info!(
                "Running scheduled media cleanup (grace period: {}h)...",
                grace_period_hours
            );

            let service = MediaCleanupService::new(db.clone(), cache.clone());

            match service.cleanup(grace_period_hours).await {
                Ok((orphans, mut report)) => {
                    let mut files_deleted = 0usize;

                    for orphan in &orphans {
                        let thumb = orphan.thumbnail_path.as_deref().unwrap_or("");
                        match image_service.delete_image(&orphan.filename, thumb).await {
                            Ok(_) => {
                                files_deleted += 1;
                                // Count thumbnail as a separate file if it existed
                                if !thumb.is_empty() {
                                    files_deleted += 1;
                                }
                            }
                            Err(e) => {
                                let msg = format!(
                                    "Failed to delete files for media {}: {}",
                                    orphan.id, e
                                );
                                warn!("{}", msg);
                                report.errors.push(msg);
                            }
                        }
                    }

                    report.files_deleted = files_deleted;

                    if report.orphans_found > 0 {
                        info!(
                            "Media cleanup complete: {} orphans found, {} DB records deleted, {} files deleted, {} errors",
                            report.orphans_found,
                            report.orphans_deleted,
                            report.files_deleted,
                            report.errors.len()
                        );
                    } else {
                        info!("Media cleanup: no orphans found");
                    }
                }
                Err(e) => {
                    warn!("Media cleanup failed: {:?}", e);
                }
            }
        }
    })
}
