use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PostStatus {
    Draft,
    Pending,
    Published,
    Archived,
}

impl From<&str> for PostStatus {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "draft" => PostStatus::Draft,
            "pending" => PostStatus::Pending,
            "published" => PostStatus::Published,
            "archived" => PostStatus::Archived,
            _ => PostStatus::Draft,
        }
    }
}

impl std::fmt::Display for PostStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PostStatus::Draft => write!(f, "draft"),
            PostStatus::Pending => write!(f, "pending"),
            PostStatus::Published => write!(f, "published"),
            PostStatus::Archived => write!(f, "archived"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PostType {
    Blog,
    Article,
    News,
}

impl From<&str> for PostType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "blog" => PostType::Blog,
            "article" => PostType::Article,
            "news" => PostType::News,
            _ => PostType::Blog,
        }
    }
}

impl std::fmt::Display for PostType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PostType::Blog => write!(f, "blog"),
            PostType::Article => write!(f, "article"),
            PostType::News => write!(f, "news"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Post {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub featured_image: Option<String>,
    pub featured_image_blur: Option<String>,
    #[sqlx(rename = "type")]
    pub post_type: String,
    pub status: String,
    pub author_id: String,
    pub approved_by: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub published_at: Option<DateTime<Utc>>,
    pub views: i32,
    pub likes: i32,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub tags: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PostLike {
    pub id: String,
    pub post_id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
}
