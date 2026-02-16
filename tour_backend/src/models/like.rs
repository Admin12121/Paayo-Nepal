use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Target types that support likes (hotels excluded per decision)
///
/// Maps to PostgreSQL enum: `like_target_type AS ENUM ('post', 'video', 'photo')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "like_target_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum LikeTargetType {
    Post,
    Video,
    Photo,
}

impl From<&str> for LikeTargetType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "video" => LikeTargetType::Video,
            "photo" => LikeTargetType::Photo,
            _ => LikeTargetType::Post,
        }
    }
}

impl std::fmt::Display for LikeTargetType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LikeTargetType::Post => write!(f, "post"),
            LikeTargetType::Video => write!(f, "video"),
            LikeTargetType::Photo => write!(f, "photo"),
        }
    }
}

/// ContentLike record — matches the `content_likes` table in PostgreSQL.
/// Deduplicated via viewer_hash (SHA-256 of IP + User-Agent + salt).
/// No user account required — public users can like content.
/// UNIQUE constraint on (target_type, target_id, viewer_hash) prevents double-likes.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContentLike {
    pub id: String,
    pub target_type: LikeTargetType,
    pub target_id: String,
    pub viewer_hash: String,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Like status response for API — tells the client whether this viewer has liked
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LikeStatus {
    pub target_type: String,
    pub target_id: String,
    pub liked: bool,
    pub like_count: i64,
}

/// Like toggle result returned after a like/unlike action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LikeToggleResult {
    pub liked: bool,
    pub like_count: i64,
}
