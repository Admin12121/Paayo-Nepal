use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{error::ApiError, models::comment::Comment, services::CacheService};

pub struct CommentService {
    db: MySqlPool,
    cache: CacheService,
}

impl CommentService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list_for_post(
        &self,
        post_id: &str,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<Comment>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let comments: Vec<Comment> = sqlx::query_as(
            "SELECT * FROM comments WHERE post_id = ? AND parent_id IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .bind(post_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM comments WHERE post_id = ? AND parent_id IS NULL")
                .bind(post_id)
                .fetch_one(&self.db)
                .await?;

        Ok((comments, total.0))
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Comment>, ApiError> {
        let comment = sqlx::query_as::<_, Comment>("SELECT * FROM comments WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(comment)
    }

    pub async fn create(
        &self,
        post_id: &str,
        user_id: &str,
        content: &str,
        parent_id: Option<&str>,
    ) -> Result<Comment, ApiError> {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO comments (id, post_id, user_id, parent_id, content, likes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(post_id)
        .bind(user_id)
        .bind(parent_id)
        .bind(content)
        .execute(&self.db)
        .await?;

        // Update post comment count
        sqlx::query("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?")
            .bind(post_id)
            .execute(&self.db)
            .await?;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, content: &str) -> Result<Comment, ApiError> {
        sqlx::query("UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ?")
            .bind(content)
            .bind(id)
            .execute(&self.db)
            .await?;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Comment not found".to_string()))
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        // Delete replies first
        sqlx::query("DELETE FROM comments WHERE parent_id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        // Delete comment
        sqlx::query("DELETE FROM comments WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    pub async fn toggle_like(&self, comment_id: &str, user_id: &str) -> Result<bool, ApiError> {
        // Check if already liked
        let existing: Option<(String,)> =
            sqlx::query_as("SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?")
                .bind(comment_id)
                .bind(user_id)
                .fetch_optional(&self.db)
                .await?;

        if let Some((like_id,)) = existing {
            // Unlike
            sqlx::query("DELETE FROM comment_likes WHERE id = ?")
                .bind(&like_id)
                .execute(&self.db)
                .await?;

            sqlx::query("UPDATE comments SET likes = likes - 1 WHERE id = ?")
                .bind(comment_id)
                .execute(&self.db)
                .await?;

            Ok(false)
        } else {
            // Like
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO comment_likes (id, comment_id, user_id, created_at) VALUES (?, ?, ?, NOW())"
            )
            .bind(&id)
            .bind(comment_id)
            .bind(user_id)
            .execute(&self.db)
            .await?;

            sqlx::query("UPDATE comments SET likes = likes + 1 WHERE id = ?")
                .bind(comment_id)
                .execute(&self.db)
                .await?;

            Ok(true)
        }
    }
}
