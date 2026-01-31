use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Activity {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub featured_image_blur: Option<String>,
    pub hero_image: Option<String>,
    pub icon: Option<String>,
    pub display_order: i32,
    pub is_active: bool,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ActivityGallery {
    pub id: String,
    pub activity_id: String,
    pub media_id: String,
    pub display_order: i32,
}
