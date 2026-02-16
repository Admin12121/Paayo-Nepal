use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::like::{LikeStatus, LikeToggleResult},
};

pub struct LikeService {
    db: PgPool,
}

impl LikeService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Atomic like toggle with target existence verification.
    ///
    /// ## How it works
    ///
    /// 1. **DELETE attempt** — try to remove an existing like for this viewer.
    ///    This is a single atomic SQL statement; concurrent DELETEs are safe
    ///    because at most one will match (`rows_affected` = 0 or 1).
    ///
    /// 2. **If deleted → unlike path** — the viewer had a like and it's now gone.
    ///
    /// 3. **If nothing deleted → like path** — verify the target content exists
    ///    (lightweight query), then INSERT with `ON CONFLICT DO NOTHING` so
    ///    concurrent inserts from the same viewer are harmless.
    ///
    /// 4. **Sync denormalized count** — instead of increment/decrement (which is
    ///    vulnerable to double-counting under concurrency), we always SET the
    ///    counter from the authoritative `COUNT(*)` on `content_likes`.
    ///
    /// This design:
    /// - Eliminates the check-then-act race condition (no SELECT-before-write).
    /// - Prevents orphan likes on non-existent content.
    /// - Keeps the existence check only on new likes (unlikes skip it — the
    ///   content must have existed for the original like to be there).
    /// - Uses `ON CONFLICT DO NOTHING` as a final safety net against dupes.
    pub async fn toggle(
        &self,
        target_type: &str,
        target_id: &str,
        viewer_hash: &str,
        ip_address: Option<&str>,
    ) -> Result<LikeToggleResult, ApiError> {
        // ── Step 1: Attempt atomic DELETE ────────────────────────────────
        let delete_result = sqlx::query(
            r#"
            DELETE FROM content_likes
            WHERE target_type = $1::like_target_type
              AND target_id = $2
              AND viewer_hash = $3
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .bind(viewer_hash)
        .execute(&self.db)
        .await?;

        let liked = if delete_result.rows_affected() > 0 {
            // ── Unlike path ─────────────────────────────────────────────
            // The like existed and has been removed.
            false
        } else {
            // ── Like path ───────────────────────────────────────────────
            // No existing like found — this is a new like request.

            // Verify the target content actually exists before inserting.
            // This is a lightweight indexed lookup that prevents bots from
            // creating orphan like rows for random/non-existent IDs.
            if !self.target_exists(target_type, target_id).await? {
                return Err(ApiError::NotFound(format!(
                    "{} with id '{}' not found",
                    target_type, target_id
                )));
            }

            // Atomic INSERT with ON CONFLICT DO NOTHING — if a concurrent
            // request already inserted a like for the same viewer+target,
            // this silently becomes a no-op instead of erroring.
            let id = Uuid::new_v4().to_string();
            let insert_result = sqlx::query(
                r#"
                INSERT INTO content_likes (id, target_type, target_id, viewer_hash, ip_address, created_at)
                VALUES ($1, $2::like_target_type, $3, $4, $5, NOW())
                ON CONFLICT (target_type, target_id, viewer_hash) DO NOTHING
                "#,
            )
            .bind(&id)
            .bind(target_type)
            .bind(target_id)
            .bind(viewer_hash)
            .bind(ip_address)
            .execute(&self.db)
            .await?;

            // If rows_affected is 0 here, a concurrent request beat us to it.
            // That's fine — the like exists either way.
            insert_result.rows_affected() > 0
        };

        // ── Step 2: Sync denormalized counter from authoritative count ──
        // Always SET (not increment/decrement) to guarantee eventual
        // consistency even under concurrent toggle storms.
        let count = self.sync_like_count(target_type, target_id).await?;

        Ok(LikeToggleResult {
            liked,
            like_count: count,
        })
    }

    /// Check whether the target content item actually exists in the database.
    ///
    /// Uses lightweight `SELECT 1 ... LIMIT 1` with the primary key index.
    /// Only checks non-deleted rows (respects soft-delete where applicable).
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
            _ => {
                // Unknown target type — treat as non-existent
                tracing::warn!(
                    "target_exists check for unknown like target_type: {}",
                    target_type
                );
                false
            }
        };
        Ok(exists)
    }

    /// Check if a viewer has liked a content item.
    pub async fn get_status(
        &self,
        target_type: &str,
        target_id: &str,
        viewer_hash: &str,
    ) -> Result<LikeStatus, ApiError> {
        let existing: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT id FROM content_likes
            WHERE target_type = $1::like_target_type
              AND target_id = $2
              AND viewer_hash = $3
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .bind(viewer_hash)
        .fetch_optional(&self.db)
        .await?;

        let count = self.get_like_count(target_type, target_id).await?;

        Ok(LikeStatus {
            target_type: target_type.to_string(),
            target_id: target_id.to_string(),
            liked: existing.is_some(),
            like_count: count,
        })
    }

    /// Get the total like count for a content item from the content_likes table.
    pub async fn get_like_count(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM content_likes
            WHERE target_type = $1::like_target_type
              AND target_id = $2
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;

        Ok(count)
    }

    /// Sync the denormalized like_count on the target table from the
    /// authoritative COUNT(*) on content_likes.
    ///
    /// This is used after every toggle (instead of increment/decrement)
    /// and can also be called for periodic consistency repair.
    pub async fn sync_like_count(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<i64, ApiError> {
        let count = self.get_like_count(target_type, target_id).await?;

        match target_type {
            "post" => {
                sqlx::query("UPDATE posts SET like_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            "video" => {
                sqlx::query("UPDATE videos SET like_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            "photo" => {
                sqlx::query("UPDATE photo_features SET like_count = $1 WHERE id = $2")
                    .bind(count as i32)
                    .bind(target_id)
                    .execute(&self.db)
                    .await?;
            }
            _ => {
                tracing::warn!(
                    "sync_like_count: unknown target_type '{}' for target_id '{}'",
                    target_type,
                    target_id
                );
            }
        }

        Ok(count)
    }

    /// Get top liked content across a specific type (for trending/popular sections).
    pub async fn top_liked(
        &self,
        target_type: &str,
        limit: i32,
    ) -> Result<Vec<(String, i64)>, ApiError> {
        let rows: Vec<(String, i64)> = sqlx::query_as(
            r#"
            SELECT target_id, COUNT(*) as like_count
            FROM content_likes
            WHERE target_type = $1::like_target_type
            GROUP BY target_id
            ORDER BY like_count DESC
            LIMIT $2
            "#,
        )
        .bind(target_type)
        .bind(limit as i64)
        .fetch_all(&self.db)
        .await?;

        Ok(rows)
    }
}

// `generate_viewer_hash` has been consolidated into `view_service.rs` and is
// re-exported from `crate::services::generate_viewer_hash`.  All callers
// (likes, views, comments) should use that single implementation.
pub use super::view_service::generate_viewer_hash;
