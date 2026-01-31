use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub featured_image_blur: Option<String>,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub location: Option<String>,
    pub region_id: Option<String>,
    pub is_recurring: bool,
    pub recurring_pattern: Option<serde_json::Value>,
    pub is_featured: bool,
    pub views: i32,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
