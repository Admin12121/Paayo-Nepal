use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::ApiError, models::comment::Comment, services::CacheService};

// Note: `target_exists` is implemented as a method on CommentService below.

pub struct CommentService {
    db: PgPool,
    #[allow(dead_code)]
    cache: CacheService,
}

impl CommentService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List approved comments for a specific content item (public).
    /// Only returns comments with status = 'approved'.
    /// Returns top-level comments (parent_id IS NULL); replies are fetched separately.
    pub async fn list_approved(
        &self,
        target_type: &str,
        target_id: &str,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<Comment>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let comments: Vec<Comment> = sqlx::query_as(
            r#"
            SELECT * FROM comments
            WHERE target_type = $1::comment_target_type
              AND target_id = $2
              AND parent_id IS NULL
              AND status = 'approved'
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM comments
            WHERE target_type = $1::comment_target_type
              AND target_id = $2
              AND parent_id IS NULL
              AND status = 'approved'
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;

        Ok((comments, total.0))
    }

    /// List replies for a given parent comment (public, approved only).
    pub async fn list_replies(&self, parent_id: &str) -> Result<Vec<Comment>, ApiError> {
        let replies: Vec<Comment> = sqlx::query_as(
            r#"
            SELECT * FROM comments
            WHERE parent_id = $1 AND status = 'approved'
            ORDER BY created_at ASC
            "#,
        )
        .bind(parent_id)
        .fetch_all(&self.db)
        .await?;

        Ok(replies)
    }

    /// List all comments for admin moderation (all statuses).
    pub async fn list_for_moderation(
        &self,
        status_filter: Option<&str>,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<Comment>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let (comments, total) = if let Some(status) = status_filter {
            let comments: Vec<Comment> = sqlx::query_as(
                r#"
                SELECT * FROM comments
                WHERE status = $1::comment_status
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(status)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM comments WHERE status = $1::comment_status")
                    .bind(status)
                    .fetch_one(&self.db)
                    .await?;

            (comments, total.0)
        } else {
            let comments: Vec<Comment> = sqlx::query_as(
                r#"
                SELECT * FROM comments
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM comments")
                .fetch_one(&self.db)
                .await?;

            (comments, total.0)
        };

        Ok((comments, total))
    }

    /// Get a comment by ID.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<Comment>, ApiError> {
        let comment = sqlx::query_as::<_, Comment>("SELECT * FROM comments WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(comment)
    }

    /// Create a new guest comment.
    /// Comments start with status = 'pending' and must be approved by an admin.
    ///
    /// Validates that the target content actually exists before inserting.
    /// This prevents bots from creating orphan comment records for random
    /// or non-existent content IDs.
    pub async fn create(
        &self,
        target_type: &str,
        target_id: &str,
        guest_name: &str,
        guest_email: &str,
        content: &str,
        parent_id: Option<&str>,
        ip_address: Option<&str>,
        viewer_hash: Option<&str>,
    ) -> Result<Comment, ApiError> {
        let id = Uuid::new_v4().to_string();

        // Verify the target content actually exists (prevents orphan comments
        // and bot spam with random/non-existent IDs).
        if !self.target_exists(target_type, target_id).await? {
            return Err(ApiError::NotFound(format!(
                "{} with id '{}' not found",
                target_type, target_id
            )));
        }

        // If this is a reply, verify the parent comment exists and belongs to the same target
        if let Some(pid) = parent_id {
            let parent = self.get_by_id(pid).await?;
            match parent {
                Some(p) => {
                    if p.target_type.to_string() != target_type || p.target_id != target_id {
                        return Err(ApiError::BadRequest(
                            "Reply must belong to the same content as the parent comment"
                                .to_string(),
                        ));
                    }
                }
                None => {
                    return Err(ApiError::NotFound("Parent comment not found".to_string()));
                }
            }
        }

        sqlx::query(
            r#"
            INSERT INTO comments (
                id, parent_id, target_type, target_id,
                guest_name, guest_email, content,
                status, ip_address, viewer_hash,
                created_at, updated_at
            )
            VALUES (
                $1, $2, $3::comment_target_type, $4,
                $5, $6, $7,
                'pending', $8, $9,
                NOW(), NOW()
            )
            "#,
        )
        .bind(&id)
        .bind(parent_id)
        .bind(target_type)
        .bind(target_id)
        .bind(guest_name)
        .bind(guest_email)
        .bind(content)
        .bind(ip_address)
        .bind(viewer_hash)
        .execute(&self.db)
        .await?;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Approve a comment (admin moderation).
    pub async fn approve(&self, id: &str) -> Result<Comment, ApiError> {
        sqlx::query("UPDATE comments SET status = 'approved' WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Comment not found".to_string()))
    }

    /// Reject a comment (admin moderation).
    pub async fn reject(&self, id: &str) -> Result<Comment, ApiError> {
        sqlx::query("UPDATE comments SET status = 'rejected' WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Comment not found".to_string()))
    }

    /// Mark a comment as spam (admin moderation).
    pub async fn mark_spam(&self, id: &str) -> Result<Comment, ApiError> {
        sqlx::query("UPDATE comments SET status = 'spam' WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Comment not found".to_string()))
    }

    /// Hard delete a comment and its replies (admin only).
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        // Delete replies first (no ON DELETE CASCADE for parent_id)
        sqlx::query("DELETE FROM comments WHERE parent_id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        // Delete the comment itself
        sqlx::query("DELETE FROM comments WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    /// Count pending comments (for admin dashboard badge).
    pub async fn count_pending(&self) -> Result<i64, ApiError> {
        let (count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM comments WHERE status = 'pending'")
                .fetch_one(&self.db)
                .await?;
        Ok(count)
    }

    /// Count approved comments for a specific content item (for display).
    pub async fn count_for_target(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM comments
            WHERE target_type = $1::comment_target_type
              AND target_id = $2
              AND status = 'approved'
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;
        Ok(count)
    }

    /// Batch approve multiple comments (admin bulk action).
    pub async fn batch_approve(&self, ids: &[String]) -> Result<u64, ApiError> {
        if ids.is_empty() {
            return Ok(0);
        }

        // Build IN clause with numbered params
        let placeholders: Vec<String> = ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("${}", i + 1))
            .collect();
        let sql = format!(
            "UPDATE comments SET status = 'approved' WHERE id IN ({})",
            placeholders.join(", ")
        );

        let mut query = sqlx::query(&sql);
        for id in ids {
            query = query.bind(id);
        }

        let result = query.execute(&self.db).await?;
        Ok(result.rows_affected())
    }

    /// Batch delete multiple comments (admin bulk action).
    pub async fn batch_delete(&self, ids: &[String]) -> Result<u64, ApiError> {
        if ids.is_empty() {
            return Ok(0);
        }

        // Delete replies first
        let placeholders: Vec<String> = ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("${}", i + 1))
            .collect();
        let reply_sql = format!(
            "DELETE FROM comments WHERE parent_id IN ({})",
            placeholders.join(", ")
        );

        let mut reply_query = sqlx::query(&reply_sql);
        for id in ids {
            reply_query = reply_query.bind(id);
        }
        reply_query.execute(&self.db).await?;

        // Delete the comments themselves
        let delete_sql = format!(
            "DELETE FROM comments WHERE id IN ({})",
            placeholders.join(", ")
        );

        let mut delete_query = sqlx::query(&delete_sql);
        for id in ids {
            delete_query = delete_query.bind(id);
        }
        let result = delete_query.execute(&self.db).await?;

        Ok(result.rows_affected())
    }

    /// Check whether the target content item actually exists in the database.
    ///
    /// Uses a lightweight `SELECT EXISTS(...)` with the primary key index.
    /// Respects soft-delete (`deleted_at IS NULL`) where applicable.
    /// Only checks published content — comments on draft content are rejected.
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
            "photo" => {
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM photo_features WHERE id = $1 AND deleted_at IS NULL AND status = 'published')",
                )
                .bind(target_id)
                .fetch_one(&self.db)
                .await?
            }
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
                    "target_exists check for unknown comment target_type: {}",
                    target_type
                );
                false
            }
        };
        Ok(exists)
    }

    /// Check rate limit: count recent comments from the same viewer hash.
    /// Returns true if the viewer should be rate-limited.
    pub async fn is_rate_limited(
        &self,
        viewer_hash: &str,
        max_per_hour: i64,
    ) -> Result<bool, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM comments
            WHERE viewer_hash = $1
              AND created_at > NOW() - INTERVAL '1 hour'
            "#,
        )
        .bind(viewer_hash)
        .fetch_one(&self.db)
        .await?;

        Ok(count >= max_per_hour)
    }
}
