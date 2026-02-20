use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::common::ContentStatus;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Region {
    pub id: String,
    pub author_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub map_data: Option<sqlx::types::Json<serde_json::Value>>,
    pub attraction_rank: Option<i32>,
    pub is_featured: bool,
    pub status: ContentStatus,
    pub province: Option<String>,
    pub district: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
