use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::common::ContentStatus;

/// PhotoFeature record — matches the `photo_features` table in PostgreSQL.
/// Represents a gallery/photo collection with multiple images.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PhotoFeature {
    pub id: String,
    pub author_id: String,
    pub region_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
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

/// PhotoImage record — matches the `photo_images` table in PostgreSQL.
/// Individual images within a photo feature collection.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PhotoImage {
    pub id: String,
    pub photo_feature_id: String,
    pub uploaded_by: Option<String>,
    pub image_url: String,
    pub caption: Option<String>,
    pub display_order: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// PhotoFeature with its associated images for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoFeatureWithImages {
    pub id: String,
    pub author_id: String,
    pub region_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub display_order: Option<i32>,
    pub is_featured: bool,
    pub like_count: i32,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub images: Vec<PhotoImage>,
}

impl PhotoFeatureWithImages {
    pub fn from_feature_and_images(feature: PhotoFeature, images: Vec<PhotoImage>) -> Self {
        Self {
            id: feature.id,
            author_id: feature.author_id,
            region_id: feature.region_id,
            title: feature.title,
            slug: feature.slug,
            description: feature.description,
            status: feature.status,
            published_at: feature.published_at,
            display_order: feature.display_order,
            is_featured: feature.is_featured,
            like_count: feature.like_count,
            view_count: feature.view_count,
            created_at: feature.created_at,
            updated_at: feature.updated_at,
            deleted_at: feature.deleted_at,
            images,
        }
    }
}
