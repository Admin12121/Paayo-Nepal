use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: String,
    pub user_id: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub notification_type: String,
    pub title: String,
    pub message: Option<String>,
    pub link: Option<String>,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}
