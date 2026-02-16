use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Hero slide content type enum — maps to PostgreSQL enum `hero_content_type`.
///
/// ```sql
/// CREATE TYPE hero_content_type AS ENUM ('post', 'video', 'photo', 'custom');
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "hero_content_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum HeroContentType {
    Post,
    Video,
    Photo,
    Custom,
}

impl From<&str> for HeroContentType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "video" => HeroContentType::Video,
            "photo" => HeroContentType::Photo,
            "custom" => HeroContentType::Custom,
            _ => HeroContentType::Post,
        }
    }
}

impl std::fmt::Display for HeroContentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HeroContentType::Post => write!(f, "post"),
            HeroContentType::Video => write!(f, "video"),
            HeroContentType::Photo => write!(f, "photo"),
            HeroContentType::Custom => write!(f, "custom"),
        }
    }
}

/// HeroSlide record — matches the `hero_slides` table in PostgreSQL.
/// Supports both content-linked slides and custom slides with arbitrary content.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HeroSlide {
    pub id: String,
    pub content_type: HeroContentType,
    pub content_id: Option<String>,
    pub custom_title: Option<String>,
    pub custom_description: Option<String>,
    pub custom_image: Option<String>,
    pub custom_link: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Resolved hero slide for API responses — includes actual content data
/// when the slide references existing content (post/video/photo)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroSlideResolved {
    pub id: String,
    pub content_type: HeroContentType,
    pub content_id: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Resolved fields (from linked content or custom fields)
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub link: Option<String>,
}

impl HeroSlideResolved {
    /// Create a resolved slide from a custom hero slide (no content lookup needed)
    pub fn from_custom(slide: &HeroSlide) -> Self {
        Self {
            id: slide.id.clone(),
            content_type: slide.content_type.clone(),
            content_id: slide.content_id.clone(),
            sort_order: slide.sort_order,
            is_active: slide.is_active,
            starts_at: slide.starts_at,
            ends_at: slide.ends_at,
            created_at: slide.created_at,
            updated_at: slide.updated_at,
            title: slide.custom_title.clone(),
            description: slide.custom_description.clone(),
            image: slide.custom_image.clone(),
            link: slide.custom_link.clone(),
        }
    }

    /// Create a resolved slide from a content-linked slide with fetched data
    pub fn from_content(
        slide: &HeroSlide,
        title: Option<String>,
        description: Option<String>,
        image: Option<String>,
        link: Option<String>,
    ) -> Self {
        Self {
            id: slide.id.clone(),
            content_type: slide.content_type.clone(),
            content_id: slide.content_id.clone(),
            sort_order: slide.sort_order,
            is_active: slide.is_active,
            starts_at: slide.starts_at,
            ends_at: slide.ends_at,
            created_at: slide.created_at,
            updated_at: slide.updated_at,
            title,
            description,
            image,
            link,
        }
    }
}
