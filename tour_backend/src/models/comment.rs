use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Comment status for moderation pipeline
///
/// Maps to PostgreSQL enum: `comment_status AS ENUM ('pending', 'approved', 'spam', 'rejected')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comment_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CommentStatus {
    Pending,
    Approved,
    Spam,
    Rejected,
}

impl From<&str> for CommentStatus {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "approved" => CommentStatus::Approved,
            "spam" => CommentStatus::Spam,
            "rejected" => CommentStatus::Rejected,
            _ => CommentStatus::Pending,
        }
    }
}

impl std::fmt::Display for CommentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommentStatus::Pending => write!(f, "pending"),
            CommentStatus::Approved => write!(f, "approved"),
            CommentStatus::Spam => write!(f, "spam"),
            CommentStatus::Rejected => write!(f, "rejected"),
        }
    }
}

/// Target types that support comments (hotels excluded per decision)
///
/// Maps to PostgreSQL enum: `comment_target_type AS ENUM ('post', 'video', 'photo')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comment_target_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CommentTargetType {
    Post,
    Video,
    Photo,
    Hotel,
}

impl From<&str> for CommentTargetType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "video" => CommentTargetType::Video,
            "photo" => CommentTargetType::Photo,
            "hotel" => CommentTargetType::Hotel,
            _ => CommentTargetType::Post,
        }
    }
}

impl std::fmt::Display for CommentTargetType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommentTargetType::Post => write!(f, "post"),
            CommentTargetType::Video => write!(f, "video"),
            CommentTargetType::Photo => write!(f, "photo"),
            CommentTargetType::Hotel => write!(f, "hotel"),
        }
    }
}

/// Comment record — matches the `comments` table in PostgreSQL.
/// Guest commenting with moderation pipeline.
/// Uses target_type + target_id polymorphic pattern (no post_id/user_id).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Comment {
    pub id: String,
    pub parent_id: Option<String>,
    pub target_type: CommentTargetType,
    pub target_id: String,
    pub guest_name: String,
    pub guest_email: String,
    pub content: String,
    pub status: CommentStatus,
    pub ip_address: Option<String>,
    pub viewer_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Comment with nested replies for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentWithReplies {
    pub id: String,
    pub parent_id: Option<String>,
    pub target_type: CommentTargetType,
    pub target_id: String,
    pub guest_name: String,
    pub content: String,
    pub status: CommentStatus,
    pub created_at: DateTime<Utc>,
    pub replies: Vec<CommentWithReplies>,
}

impl From<Comment> for CommentWithReplies {
    fn from(c: Comment) -> Self {
        Self {
            id: c.id,
            parent_id: c.parent_id,
            target_type: c.target_type,
            target_id: c.target_id,
            guest_name: c.guest_name,
            content: c.content,
            status: c.status,
            created_at: c.created_at,
            replies: Vec::new(),
        }
    }
}
