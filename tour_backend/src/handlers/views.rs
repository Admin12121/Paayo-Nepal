use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::{
    error::ApiError,
    extractors::auth::AdminUser,
    models::view::{DailyViewStats, RecordViewRequest, ViewStats},
    services::{generate_viewer_hash, ViewService},
    AppState,
};

/// Record a content view (public — no auth required).
/// Uses IP + User-Agent hash for deduplication within a 24h window.
pub async fn record_view(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<RecordViewRequest>,
) -> Result<Json<RecordViewResponse>, ApiError> {
    // Validate target_type
    let valid_types = ["post", "video", "photo", "hotel"];
    if !valid_types.contains(&input.target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo, hotel",
            input.target_type
        )));
    }

    if input.target_id.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "target_id cannot be empty".to_string(),
        ));
    }

    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    let referrer = headers
        .get(axum::http::header::REFERER)
        .and_then(|v| v.to_str().ok());

    let viewer_hash = generate_viewer_hash(&ip, user_agent, "view");

    let service = ViewService::new(state.db.clone());
    let recorded = service
        .record_view(&input, &viewer_hash, Some(&ip), Some(user_agent), referrer)
        .await?;

    Ok(Json(RecordViewResponse { recorded }))
}

/// Get view stats for a specific content item (public).
pub async fn get_stats(
    State(state): State<AppState>,
    Path((target_type, target_id)): Path<(String, String)>,
) -> Result<Json<ViewStats>, ApiError> {
    let valid_types = ["post", "video", "photo", "hotel"];
    if !valid_types.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'",
            target_type
        )));
    }

    let service = ViewService::new(state.db.clone());
    let stats = service.get_stats(&target_type, &target_id).await?;

    Ok(Json(stats))
}

/// Get daily view stats for a content item (admin — for analytics charts).
pub async fn daily_stats(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path((target_type, target_id)): Path<(String, String)>,
    Query(query): Query<DailyStatsQuery>,
) -> Result<Json<Vec<DailyViewStats>>, ApiError> {
    let days = query.days.unwrap_or(30).min(365).max(1);

    let service = ViewService::new(state.db.clone());
    let stats = service
        .get_daily_stats(&target_type, &target_id, days)
        .await?;

    Ok(Json(stats))
}

/// Get trending content by type (public).
pub async fn trending(
    State(state): State<AppState>,
    Path(target_type): Path<String>,
    Query(query): Query<TrendingQuery>,
) -> Result<Json<TrendingResponse>, ApiError> {
    let valid_types = ["post", "video", "photo", "hotel"];
    if !valid_types.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'",
            target_type
        )));
    }

    let days = query.days.unwrap_or(7).min(90).max(1);
    let limit = query.limit.unwrap_or(10).min(50).max(1);

    let service = ViewService::new(state.db.clone());
    let items = service.trending(&target_type, days, limit).await?;

    let results: Vec<TrendingItem> = items
        .into_iter()
        .map(|(id, count)| TrendingItem {
            target_id: id,
            view_count: count,
        })
        .collect();

    Ok(Json(TrendingResponse {
        target_type,
        days,
        items: results,
    }))
}

/// Get total views summary across all content types (admin).
pub async fn summary(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<Vec<ViewSummaryItem>>, ApiError> {
    let service = ViewService::new(state.db.clone());
    let rows = service.total_views_summary().await?;

    let items: Vec<ViewSummaryItem> = rows
        .into_iter()
        .map(
            |(target_type, total_views, unique_viewers)| ViewSummaryItem {
                target_type,
                total_views,
                unique_viewers,
            },
        )
        .collect();

    Ok(Json(items))
}

/// Trigger daily view aggregation (admin — typically called by cron/scheduler).
pub async fn aggregate(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<AggregateResponse>, ApiError> {
    let service = ViewService::new(state.db.clone());
    let rows_affected = service.aggregate_daily().await?;

    Ok(Json(AggregateResponse { rows_affected }))
}

/// Prune old raw view records (admin — data retention maintenance).
pub async fn prune(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<PruneQuery>,
) -> Result<Json<PruneResponse>, ApiError> {
    let retention_days = query.retention_days.unwrap_or(90).max(7);

    let service = ViewService::new(state.db.clone());
    let deleted = service.prune_old_views(retention_days).await?;

    Ok(Json(PruneResponse {
        deleted,
        retention_days,
    }))
}

// ─── Request / Response Types ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RecordViewResponse {
    pub recorded: bool,
}

#[derive(Debug, Deserialize)]
pub struct DailyStatsQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct TrendingQuery {
    pub days: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct TrendingResponse {
    pub target_type: String,
    pub days: i32,
    pub items: Vec<TrendingItem>,
}

#[derive(Debug, Serialize)]
pub struct TrendingItem {
    pub target_id: String,
    pub view_count: i64,
}

#[derive(Debug, Serialize)]
pub struct ViewSummaryItem {
    pub target_type: String,
    pub total_views: i64,
    pub unique_viewers: i64,
}

#[derive(Debug, Serialize)]
pub struct AggregateResponse {
    pub rows_affected: u64,
}

#[derive(Debug, Deserialize)]
pub struct PruneQuery {
    pub retention_days: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct PruneResponse {
    pub deleted: u64,
    pub retention_days: i32,
}
