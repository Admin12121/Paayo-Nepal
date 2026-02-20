use redis::AsyncCommands;
use sqlx::PgPool;

use crate::error::ApiError;
use crate::models::notification::Notification;

pub struct NotificationService {
    db: PgPool,
    redis: Option<redis::aio::ConnectionManager>,
}

impl NotificationService {
    pub fn new(db: PgPool) -> Self {
        Self { db, redis: None }
    }

    pub fn with_redis(db: PgPool, redis: redis::aio::ConnectionManager) -> Self {
        Self {
            db,
            redis: Some(redis),
        }
    }

    pub async fn create(
        &self,
        recipient_id: &str,
        actor_id: Option<&str>,
        notification_type: &str,
        title: &str,
        message: Option<&str>,
        target_type: Option<&str>,
        target_id: Option<&str>,
        action_url: Option<&str>,
    ) -> Result<(), ApiError> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO notifications (
                id, recipient_id, actor_id, type, title, message,
                target_type, target_id, action_url, is_read, created_at
            )
            VALUES ($1, $2, $3, $4::notification_type, $5, $6, $7, $8, $9, false, NOW())
            "#,
        )
        .bind(&id)
        .bind(recipient_id)
        .bind(actor_id)
        .bind(notification_type)
        .bind(title)
        .bind(message)
        .bind(target_type)
        .bind(target_id)
        .bind(action_url)
        .execute(&self.db)
        .await?;

        // Publish new notification event to Redis for real-time SSE
        if let Some(ref redis) = self.redis {
            let channel = format!("notifications:{}", recipient_id);
            let payload = serde_json::json!({
                "id": id,
                "type": notification_type,
                "title": title,
                "message": message,
                "action_url": action_url,
                "target_type": target_type,
                "target_id": target_id,
            });
            let mut conn = redis.clone();
            if let Err(e) = conn
                .publish::<_, _, i32>(&channel, payload.to_string())
                .await
            {
                tracing::warn!("Failed to publish notification to Redis: {}", e);
            }

            // Also publish an updated unread count so the SSE stream can push it
            self.publish_count_update(recipient_id).await;
        }

        Ok(())
    }

    /// Publish an updated unread count to the user's count channel.
    /// The SSE stream subscribes to `notifications:{user_id}:count` to receive these.
    pub async fn publish_count_update(&self, recipient_id: &str) {
        if let Some(ref redis) = self.redis {
            match self.count_unread(recipient_id).await {
                Ok(count) => {
                    let channel = format!("notifications:{}:count", recipient_id);
                    let payload = serde_json::json!({ "count": count }).to_string();
                    let mut conn = redis.clone();
                    if let Err(e) = conn.publish::<_, _, i32>(&channel, payload).await {
                        tracing::warn!(
                            "Failed to publish count update to Redis for {}: {}",
                            recipient_id,
                            e
                        );
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to query unread count for {}: {}", recipient_id, e);
                }
            }
        }
    }

    /// Notify all admin users about an event.
    pub async fn notify_admins(
        &self,
        actor_id: Option<&str>,
        notification_type: &str,
        title: &str,
        message: Option<&str>,
        target_type: Option<&str>,
        target_id: Option<&str>,
        action_url: Option<&str>,
    ) -> Result<(), ApiError> {
        let admins: Vec<(String,)> = sqlx::query_as("SELECT id FROM \"user\" WHERE role = 'admin'")
            .fetch_all(&self.db)
            .await?;
        for (admin_id,) in admins {
            self.create(
                &admin_id,
                actor_id,
                notification_type,
                title,
                message,
                target_type,
                target_id,
                action_url,
            )
            .await?;
        }
        Ok(())
    }

    /// Notify a specific user (e.g. editor whose content got a comment).
    pub async fn notify_user(
        &self,
        recipient_id: &str,
        actor_id: Option<&str>,
        notification_type: &str,
        title: &str,
        message: Option<&str>,
        target_type: Option<&str>,
        target_id: Option<&str>,
        action_url: Option<&str>,
    ) -> Result<(), ApiError> {
        self.create(
            recipient_id,
            actor_id,
            notification_type,
            title,
            message,
            target_type,
            target_id,
            action_url,
        )
        .await
    }

    /// Get notifications for a user, ordered by most recent.
    pub async fn get_for_user(
        &self,
        recipient_id: &str,
        limit: i32,
    ) -> Result<Vec<Notification>, ApiError> {
        let notifications = sqlx::query_as::<_, Notification>(
            r#"
            SELECT id, recipient_id, actor_id, type, title, message,
                   target_type, target_id, action_url, is_read, created_at
            FROM notifications
            WHERE recipient_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(recipient_id)
        .bind(limit as i64)
        .fetch_all(&self.db)
        .await?;
        Ok(notifications)
    }

    /// Count unread notifications for a user.
    pub async fn count_unread(&self, recipient_id: &str) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false",
        )
        .bind(recipient_id)
        .fetch_one(&self.db)
        .await?;
        Ok(count)
    }

    /// Mark a single notification as read and publish the updated count to Redis.
    pub async fn mark_read(&self, id: &str, recipient_id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2")
            .bind(id)
            .bind(recipient_id)
            .execute(&self.db)
            .await?;

        // Push updated unread count to SSE via Redis
        self.publish_count_update(recipient_id).await;

        Ok(())
    }

    /// Mark all notifications as read for a user and publish the updated count to Redis.
    pub async fn mark_all_read(&self, recipient_id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE notifications SET is_read = true WHERE recipient_id = $1")
            .bind(recipient_id)
            .execute(&self.db)
            .await?;

        // Push updated unread count (0) to SSE via Redis
        self.publish_count_update(recipient_id).await;

        Ok(())
    }

    /// Delete old notifications (cleanup job).
    pub async fn delete_old(&self, days: i32) -> Result<u64, ApiError> {
        let result = sqlx::query(
            "DELETE FROM notifications WHERE created_at < NOW() - ($1 || ' days')::INTERVAL",
        )
        .bind(days.to_string())
        .execute(&self.db)
        .await?;
        Ok(result.rows_affected())
    }
}
