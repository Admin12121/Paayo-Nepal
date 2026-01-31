use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Image,
    VideoLink,
    Document,
}

impl From<&str> for MediaType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "image" => MediaType::Image,
            "video_link" => MediaType::VideoLink,
            "document" => MediaType::Document,
            _ => MediaType::Image,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Media {
    pub id: String,
    pub filename: String,
    pub original_name: String,
    pub mime_type: String,
    pub size: i64,
    #[sqlx(rename = "type")]
    pub media_type: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub blur_hash: Option<String>,
    pub thumbnail_path: Option<String>,
    pub alt: Option<String>,
    pub caption: Option<String>,
    pub uploaded_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct VideoLink {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub platform: Option<String>,
    pub duration: Option<String>,
    pub views: i32,
    pub featured: bool,
    pub uploaded_by: String,
    pub created_at: DateTime<Utc>,
}
