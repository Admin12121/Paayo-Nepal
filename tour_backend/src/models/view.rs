use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Target types that support view tracking
///
/// Maps to PostgreSQL enum: `view_target_type AS ENUM ('post', 'video', 'photo', 'hotel')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "view_target_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ViewTargetType {
    Post,
    Video,
    Photo,
    Hotel,
}

impl From<&str> for ViewTargetType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "video" => ViewTargetType::Video,
            "photo" => ViewTargetType::Photo,
            "hotel" => ViewTargetType::Hotel,
            _ => ViewTargetType::Post,
        }
    }
}

impl std::fmt::Display for ViewTargetType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ViewTargetType::Post => write!(f, "post"),
            ViewTargetType::Video => write!(f, "video"),
            ViewTargetType::Photo => write!(f, "photo"),
            ViewTargetType::Hotel => write!(f, "hotel"),
        }
    }
}

/// ContentView record — matches the `content_views` table in PostgreSQL.
/// Raw view tracking with viewer fingerprint for deduplication.
/// Dedup logic: same viewer_hash + target within a time window (e.g. 24h) = 1 view.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContentView {
    pub id: String,
    pub target_type: ViewTargetType,
    pub target_id: String,
    pub viewer_hash: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub referrer: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// ViewAggregate record — matches the `view_aggregates` table in PostgreSQL.
/// Daily aggregated view counts, computed by a background job.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ViewAggregate {
    pub id: String,
    pub target_type: ViewTargetType,
    pub target_id: String,
    pub view_date: NaiveDate,
    pub view_count: i32,
    pub unique_viewers: i32,
}

/// Request body for recording a view from the client
#[derive(Debug, Clone, Deserialize)]
pub struct RecordViewRequest {
    pub target_type: String,
    pub target_id: String,
}

/// View stats response for a single content item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewStats {
    pub target_type: String,
    pub target_id: String,
    pub total_views: i64,
    pub unique_views: i64,
}

/// Daily view stats for analytics
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DailyViewStats {
    pub view_date: NaiveDate,
    pub view_count: i64,
    pub unique_viewers: i64,
}

/// Aggregate stats for admin dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentViewSummary {
    pub target_type: String,
    pub target_id: String,
    pub title: Option<String>,
    pub total_views: i64,
    pub total_unique: i64,
    pub views_today: i64,
    pub views_this_week: i64,
    pub views_this_month: i64,
}
