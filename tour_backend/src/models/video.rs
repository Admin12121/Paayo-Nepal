use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::common::ContentStatus;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "video_platform", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoPlatform {
    Youtube,
    Vimeo,
    Tiktok,
}

impl From<&str> for VideoPlatform {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "vimeo" => VideoPlatform::Vimeo,
            "tiktok" => VideoPlatform::Tiktok,
            _ => VideoPlatform::Youtube,
        }
    }
}

impl std::fmt::Display for VideoPlatform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VideoPlatform::Youtube => write!(f, "youtube"),
            VideoPlatform::Vimeo => write!(f, "vimeo"),
            VideoPlatform::Tiktok => write!(f, "tiktok"),
        }
    }
}

/// Video record — matches the `videos` table in PostgreSQL.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Video {
    pub id: String,
    pub author_id: String,
    pub region_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub platform: VideoPlatform,
    pub video_url: String,
    pub video_id: Option<String>,
    pub thumbnail_url: Option<String>,
    pub duration: Option<i32>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub display_order: Option<i32>,
    pub is_featured: bool,
    pub like_count: i32,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
