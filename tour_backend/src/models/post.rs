use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::common::ContentStatus;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "post_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum PostType {
    Article,
    Event,
    Activity,
    Explore,
}

impl From<&str> for PostType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "article" => PostType::Article,
            "event" => PostType::Event,
            "activity" => PostType::Activity,
            "explore" => PostType::Explore,
            _ => PostType::Article,
        }
    }
}

impl std::fmt::Display for PostType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PostType::Article => write!(f, "article"),
            PostType::Event => write!(f, "event"),
            PostType::Activity => write!(f, "activity"),
            PostType::Explore => write!(f, "explore"),
        }
    }
}

// Keep PostStatus as an alias / re-export of ContentStatus for backward compatibility
pub type PostStatus = ContentStatus;

/// Post record — matches the `posts` table in PostgreSQL.
/// Unified table for article, event, activity, and explore content types.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Post {
    pub id: String,

    /// The content type of this post (e.g. "article", "event", "activity", "explore").
    ///
    /// ## Rename chain
    ///
    /// - **Database column:** `type` (PostgreSQL enum `post_type`)
    /// - **Rust field:** `post_type` (because `type` is a reserved keyword in Rust)
    /// - **JSON key:** `"type"` (via `#[serde(rename = "type")]`)
    ///
    /// All three layers refer to the same value. The Rust name differs only
    /// because `type` cannot be used as an identifier. When reading JSON
    /// responses or writing SQL, use `type`; in Rust code, use `post_type`.
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub post_type: PostType,
    pub author_id: String,
    pub region_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub short_description: Option<String>,
    pub content: Option<sqlx::types::Json<serde_json::Value>>,
    pub cover_image: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub event_date: Option<DateTime<Utc>>,
    pub event_end_date: Option<DateTime<Utc>>,
    pub display_order: Option<i32>,
    pub is_featured: bool,
    pub like_count: i32,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
