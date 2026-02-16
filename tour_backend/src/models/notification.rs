use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Notification type enum — maps to PostgreSQL enum `notification_type`.
///
/// ```sql
/// CREATE TYPE notification_type AS ENUM ('new_user', 'verified', 'content', 'comment', 'milestone');
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "notification_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum NotificationType {
    #[serde(rename = "new_user")]
    #[sqlx(rename = "new_user")]
    NewUser,
    Verified,
    Content,
    Comment,
    Milestone,
}

impl From<&str> for NotificationType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "new_user" => NotificationType::NewUser,
            "verified" => NotificationType::Verified,
            "content" => NotificationType::Content,
            "comment" => NotificationType::Comment,
            "milestone" => NotificationType::Milestone,
            _ => NotificationType::Content,
        }
    }
}

impl std::fmt::Display for NotificationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NotificationType::NewUser => write!(f, "new_user"),
            NotificationType::Verified => write!(f, "verified"),
            NotificationType::Content => write!(f, "content"),
            NotificationType::Comment => write!(f, "comment"),
            NotificationType::Milestone => write!(f, "milestone"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: String,
    pub recipient_id: String,
    pub actor_id: Option<String>,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub notification_type: NotificationType,
    pub title: String,
    pub message: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub action_url: Option<String>,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}
