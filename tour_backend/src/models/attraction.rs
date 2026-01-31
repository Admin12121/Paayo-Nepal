use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attraction {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub featured_image_blur: Option<String>,
    pub region_id: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address: Option<String>,
    pub opening_hours: Option<serde_json::Value>,
    pub entry_fee: Option<String>,
    pub is_top_attraction: bool,
    pub views: i32,
    pub rating: Option<f64>,
    pub review_count: i32,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AttractionActivity {
    pub attraction_id: String,
    pub activity_id: String,
}
