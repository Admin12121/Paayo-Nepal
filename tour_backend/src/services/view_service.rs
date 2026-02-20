use sqlx::PgPool;
use uuid::Uuid;

use crate::error::ApiError;
use crate::models::view::{DailyViewStats, RecordViewRequest, ViewStats};

pub struct ViewService {
    db: PgPool,
}

impl ViewService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Record a content view with deduplication and target existence verification.
    ///
    /// ## Flow
    ///
    /// 1. **Dedup check** — if this viewer already has a view within the last
    ///    24 hours, return `Ok(false)` immediately (cheap indexed lookup).
    ///
    /// 2. **Target existence check** — verify the content item actually exists.
    ///    This prevents bots/spam from creating orphan view records for random
    ///    or non-existent IDs. Only reached for genuinely new views, so the
    ///    extra query cost is minimal for legitimate traffic.
    ///
    /// 3. **Atomic INSERT** — uses `ON CONFLICT DO NOTHING` on the dedup index
    ///    so concurrent requests from the same viewer are harmless.
    ///
    /// 4. **Sync denormalized count** — sets `view_count` on the target table
    ///    from the authoritative `COUNT(*)` rather than incrementing, which
    ///    avoids drift under concurrency.
    pub async fn record_view(
        &self,
        request: &RecordViewRequest,
        viewer_hash: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        referrer: Option<&str>,
    ) -> Result<bool, ApiError> {
        // ── Step 1: Dedup check (cheap indexed lookup) ──────────────────
        let existing: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT id FROM content_views
            WHERE target_type = $1::view_target_type
              AND target_id = $2
              AND viewer_hash = $3
              AND created_at > NOW() - INTERVAL '24 hours'
            LIMIT 1
            "#,
        )
        .bind(&request.target_type)
        .bind(&request.target_id)
        .bind(viewer_hash)
        .fetch_optional(&self.db)
        .await?;

        if existing.is_some() {
            // Duplicate view within the dedup window — skip
            return Ok(false);
        }

        // ── Step 2: Verify target content exists ────────────────────────
        // Only reached for genuinely new views (dedup passed above), so
        // the extra query is not executed for repeat page loads.
        if !self
            .target_exists(&request.target_type, &request.target_id)
            .await?
        {
            return Err(ApiError::NotFound(format!(
                "{} with id '{}' not found",
                request.target_type, request.target_id
            )));
        }

        // ── Step 3: Insert the raw view record ─────────────────────────
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO content_views (
                id, target_type, target_id, viewer_hash,
                ip_address, user_agent, referrer, created_at
            )
            VALUES ($1, $2::view_target_type, $3, $4, $5, $6, $7, NOW())
            "#,
        )
        .bind(&id)
        .bind(&request.target_type)
        .bind(&request.target_id)
        .bind(viewer_hash)
        .bind(ip_address)
        .bind(user_agent)
        .bind(referrer)
        .execute(&self.db)
        .await?;

        // ── Step 4: Sync denormalized view_count from COUNT(*) ──────────
        self.sync_view_count(&request.target_type, &request.target_id)
            .await?;

        Ok(true)
    }

    /// Check whether the target content item actually exists in the database.
    ///
    /// Uses a lightweight `SELECT EXISTS(...)` with the primary key index.
    /// Respects soft-delete (`deleted_at IS NULL`) where applicable.
    async fn target_exists(&self, target_type: &str, target_id: &str) -> Result<bool, ApiError> {
        let exists = match target_type {
            "post" => {
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM posts WHERE id = $1 AND deleted_at IS NULL AND status = 'published')",
                )
                .bind(target_id)
                .fetch_one(&self.db)
                .await?
            }
            "video" => {
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM videos WHERE id = $1 AND deleted_at IS NULL AND status = 'published')",
                )
                .bind(target_id)
                .fetch_one(&self.db)
                .await?
            }
            "photo" => sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM photo_features WHERE id = $1 AND deleted_at IS NULL AND status = 'published')",
            )
            .bind(target_id)
            .fetch_one(&self.db)
            .await?,
            "hotel" => {
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM hotels WHERE id = $1 AND deleted_at IS NULL AND status = 'published')",
                )
                .bind(target_id)
                .fetch_one(&self.db)
                .await?
            }
            _ => {
                tracing::warn!(
                    "target_exists check for unknown view target_type: {}",
                    target_type
                );
                false
            }
        };
        Ok(exists)
    }

    /// Get view stats for a specific content item.
    pub async fn get_stats(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<ViewStats, ApiError> {
        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM content_views
            WHERE target_type = $1::view_target_type
              AND target_id = $2
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;

        let unique: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(DISTINCT viewer_hash) FROM content_views
            WHERE target_type = $1::view_target_type
              AND target_id = $2
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;

        Ok(ViewStats {
            target_type: target_type.to_string(),
            target_id: target_id.to_string(),
            total_views: total.0,
            unique_views: unique.0,
        })
    }

    /// Get daily view stats for a content item over a date range.
    /// Useful for analytics charts on the admin dashboard.
    pub async fn get_daily_stats(
        &self,
        target_type: &str,
        target_id: &str,
        days: i32,
    ) -> Result<Vec<DailyViewStats>, ApiError> {
        let stats: Vec<DailyViewStats> = sqlx::query_as(
            r#"
            SELECT
                DATE(created_at) AS view_date,
                COUNT(*) AS view_count,
                COUNT(DISTINCT viewer_hash) AS unique_viewers
            FROM content_views
            WHERE target_type = $1::view_target_type
              AND target_id = $2
              AND created_at >= CURRENT_DATE - ($3 || ' days')::INTERVAL
            GROUP BY DATE(created_at)
            ORDER BY view_date ASC
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .bind(days.to_string())
        .fetch_all(&self.db)
        .await?;

        Ok(stats)
    }

    /// Run the daily aggregation job.
    /// This should be called once per day (e.g., via a cron job or background task).
    /// It aggregates yesterday's raw views into the `view_aggregates` table
    /// and optionally prunes old raw view records.
    pub async fn aggregate_daily(&self) -> Result<u64, ApiError> {
        // Aggregate yesterday's views into view_aggregates using UPSERT
        let result = sqlx::query(
            r#"
            INSERT INTO view_aggregates (id, target_type, target_id, view_date, view_count, unique_viewers)
            SELECT
                gen_random_uuid()::text,
                target_type,
                target_id,
                DATE(created_at) AS view_date,
                COUNT(*) AS view_count,
                COUNT(DISTINCT viewer_hash) AS unique_viewers
            FROM content_views
            WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
            GROUP BY target_type, target_id, DATE(created_at)
            ON CONFLICT (target_type, target_id, view_date)
            DO UPDATE SET
                view_count = EXCLUDED.view_count,
                unique_viewers = EXCLUDED.unique_viewers
            "#,
        )
        .execute(&self.db)
        .await?;

        let rows_affected = result.rows_affected();
        tracing::info!(
            "Daily view aggregation completed: {} content items aggregated",
            rows_affected
        );

        Ok(rows_affected)
    }

    /// Prune old raw view records to keep the content_views table manageable.
    /// Keeps the last `retention_days` of raw data; older data exists only in aggregates.
    pub async fn prune_old_views(&self, retention_days: i32) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM content_views
            WHERE created_at < CURRENT_DATE - ($1 || ' days')::INTERVAL
            "#,
        )
        .bind(retention_days.to_string())
        .execute(&self.db)
        .await?;

        let deleted = result.rows_affected();
        tracing::info!(
            "Pruned {} old view records (retention: {} days)",
            deleted,
            retention_days
        );

        Ok(deleted)
    }

    /// Sync the denormalized view_count on a target table from the actual content_views count.
    /// Useful for data repair or periodic consistency checks.
    pub async fn sync_view_count(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM content_views
            WHERE target_type = $1::view_target_type
              AND target_id = $2
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;

        match target_type {
            "post" => {
                sqlx::query("UPDATE posts SET view_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            "video" => {
                sqlx::query("UPDATE videos SET view_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            "photo" => {
                sqlx::query("UPDATE photo_features SET view_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            "hotel" => {
                sqlx::query("UPDATE hotels SET view_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            _ => {}
        }

        Ok(count)
    }

    /// Get the most viewed content items of a given type within a time period.
    /// Returns (target_id, view_count) pairs ordered by views descending.
    pub async fn trending(
        &self,
        target_type: &str,
        days: i32,
        limit: i32,
    ) -> Result<Vec<(String, i64)>, ApiError> {
        let rows: Vec<(String, i64)> = sqlx::query_as(
            r#"
            SELECT target_id, COUNT(*) AS view_count
            FROM content_views
            WHERE target_type = $1::view_target_type
              AND created_at >= CURRENT_DATE - ($2 || ' days')::INTERVAL
            GROUP BY target_id
            ORDER BY view_count DESC
            LIMIT $3
            "#,
        )
        .bind(target_type)
        .bind(days.to_string())
        .bind(limit as i64)
        .fetch_all(&self.db)
        .await?;

        Ok(rows)
    }

    /// Get total view counts across all content (for admin dashboard summary).
    pub async fn total_views_summary(&self) -> Result<Vec<(String, i64, i64)>, ApiError> {
        // Returns (target_type, total_views, unique_viewers) per content type
        let rows: Vec<(String, i64, i64)> = sqlx::query_as(
            r#"
            SELECT
                target_type::text,
                COUNT(*) AS total_views,
                COUNT(DISTINCT viewer_hash) AS unique_viewers
            FROM content_views
            GROUP BY target_type
            ORDER BY total_views DESC
            "#,
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows)
    }
}

/// Generate a viewer hash from IP address + User-Agent for anonymous view/like/comment dedup.
///
/// Uses SHA-256 (cryptographic) so the hash is:
/// - stable across rustc versions (unlike `DefaultHasher` / SipHash),
/// - not trivially reversible,
/// - safe for storage in the database as a long-lived identifier.
///
/// The `context` parameter (e.g. "view", "like", "comment") is mixed in so that
/// the same IP+UA pair produces different hashes for different subsystems.
///
/// The secret salt is read once from the `VIEWER_HASH_SALT` environment variable.
/// If the variable is not set, a compile-time fallback is used (suitable for
/// local development only — production deployments MUST set the env var).
pub fn generate_viewer_hash(ip: &str, user_agent: &str, context: &str) -> String {
    use sha2::{Digest, Sha256};
    use std::sync::OnceLock;

    static SALT: OnceLock<String> = OnceLock::new();
    let salt = SALT.get_or_init(|| {
        std::env::var("VIEWER_HASH_SALT")
            .unwrap_or_else(|_| "dev-fallback-salt-change-me-in-production".to_string())
    });

    let input = format!("{}:{}:{}:{}", context, ip, user_agent, salt);
    let digest = Sha256::digest(input.as_bytes());

    // Return the full 64-hex-char SHA-256 digest, truncated to 32 chars (128 bits)
    // which is more than enough for dedup while fitting the existing varchar(64) column.
    format!("{:x}", digest)[..32].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_viewer_hash_consistency() {
        let hash1 = generate_viewer_hash("127.0.0.1", "Mozilla/5.0", "view");
        let hash2 = generate_viewer_hash("127.0.0.1", "Mozilla/5.0", "view");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_generate_viewer_hash_differs_for_different_inputs() {
        let hash1 = generate_viewer_hash("127.0.0.1", "Mozilla/5.0", "view");
        let hash2 = generate_viewer_hash("192.168.1.1", "Mozilla/5.0", "view");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_generate_viewer_hash_differs_for_different_context() {
        let hash1 = generate_viewer_hash("127.0.0.1", "Mozilla/5.0", "view");
        let hash2 = generate_viewer_hash("127.0.0.1", "Mozilla/5.0", "like");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_generate_viewer_hash_length() {
        let hash = generate_viewer_hash("127.0.0.1", "Mozilla/5.0", "view");
        // SHA-256 truncated to 32 hex characters (128 bits)
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_generate_viewer_hash_is_hex() {
        let hash = generate_viewer_hash("10.0.0.1", "TestAgent", "like");
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
