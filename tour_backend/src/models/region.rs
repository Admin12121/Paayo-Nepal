use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Region {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub featured_image: Option<String>,
    pub featured_image_blur: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub province: Option<String>,
    pub district: Option<String>,
    pub display_order: i32,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
