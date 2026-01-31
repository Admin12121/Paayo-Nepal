use redis::AsyncCommands;
use sqlx::MySqlPool;

use crate::error::ApiError;
use crate::models::notification::Notification;

pub struct NotificationService {
    db: MySqlPool,
    redis: Option<redis::aio::ConnectionManager>,
}

impl NotificationService {
    pub fn new(db: MySqlPool) -> Self {
        Self { db, redis: None }
    }

    pub fn with_redis(db: MySqlPool, redis: redis::aio::ConnectionManager) -> Self {
        Self { db, redis: Some(redis) }
    }

    pub async fn create(
        &self,
        user_id: &str,
        notification_type: &str,
        title: &str,
        message: Option<&str>,
        link: Option<&str>,
    ) -> Result<(), ApiError> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `link`)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(notification_type)
        .bind(title)
        .bind(message)
        .bind(link)
        .execute(&self.db)
        .await?;

        // Publish to Redis for real-time SSE
        if let Some(ref redis) = self.redis {
            let channel = format!("notifications:{}", user_id);
            let payload = serde_json::json!({
                "id": id,
                "type": notification_type,
                "title": title,
                "message": message,
                "link": link
            });
            let mut conn = redis.clone();
            if let Err(e) = conn.publish::<_, _, i32>(&channel, payload.to_string()).await {
                tracing::warn!("Failed to publish notification to Redis: {}", e);
            }
        }

        Ok(())
    }

    pub async fn notify_admins(
        &self,
        notification_type: &str,
        title: &str,
        message: Option<&str>,
        link: Option<&str>,
    ) -> Result<(), ApiError> {
        let admins: Vec<(String,)> = sqlx::query_as("SELECT id FROM `user` WHERE role = 'admin'")
            .fetch_all(&self.db)
            .await?;
        for (admin_id,) in admins {
            self.create(&admin_id, notification_type, title, message, link)
                .await?;
        }
        Ok(())
    }

    pub async fn get_for_user(
        &self,
        user_id: &str,
        limit: i32,
    ) -> Result<Vec<Notification>, ApiError> {
        let notifications = sqlx::query_as::<_, Notification>(
            r#"SELECT `id`, `user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`
               FROM `notifications`
               WHERE `user_id` = ?
               ORDER BY `created_at` DESC
               LIMIT ?"#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.db)
        .await?;
        Ok(notifications)
    }

    pub async fn count_unread(&self, user_id: &str) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM `notifications` WHERE `user_id` = ? AND `is_read` = 0",
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;
        Ok(count)
    }

    pub async fn mark_read(&self, id: &str, user_id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE `notifications` SET `is_read` = 1 WHERE `id` = ? AND `user_id` = ?")
            .bind(id)
            .bind(user_id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    pub async fn mark_all_read(&self, user_id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE `notifications` SET `is_read` = 1 WHERE `user_id` = ?")
            .bind(user_id)
            .execute(&self.db)
            .await?;
        Ok(())
    }
}
