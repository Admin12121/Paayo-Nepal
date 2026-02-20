use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::{
    error::ApiError,
    models::like::{LikeStatus, LikeToggleResult},
    services::{generate_viewer_hash, LikeService},
    AppState,
};

/// Toggle like for a content item (public — no auth required).
/// Uses IP + User-Agent hash for deduplication.
/// If the viewer already liked it, this unlikes it. Otherwise, it likes it.
pub async fn toggle_like(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path((target_type, target_id)): Path<(String, String)>,
) -> Result<Json<LikeToggleResult>, ApiError> {
    // Validate target_type
    let valid_types = ["post", "video", "photo"];
    if !valid_types.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo",
            target_type
        )));
    }

    if target_id.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "target_id cannot be empty".to_string(),
        ));
    }

    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    let viewer_hash = generate_viewer_hash(&ip, user_agent, "like");

    let service = LikeService::new(state.db.clone());
    let result = service
        .toggle(&target_type, &target_id, &viewer_hash, Some(&ip))
        .await?;

    Ok(Json(result))
}

/// Get like status for a content item from this viewer's perspective (public).
/// Returns whether the current viewer has liked it and the total like count.
pub async fn get_like_status(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path((target_type, target_id)): Path<(String, String)>,
) -> Result<Json<LikeStatus>, ApiError> {
    let valid_types = ["post", "video", "photo"];
    if !valid_types.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo",
            target_type
        )));
    }

    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    let viewer_hash = generate_viewer_hash(&ip, user_agent, "like");

    let service = LikeService::new(state.db.clone());
    let status = service
        .get_status(&target_type, &target_id, &viewer_hash)
        .await?;

    Ok(Json(status))
}

/// Get top liked content for a given type (public).
/// Returns a ranked list of content IDs by like count.
pub async fn top_liked(
    State(state): State<AppState>,
    Path(target_type): Path<String>,
    Query(query): Query<TopLikedQuery>,
) -> Result<Json<TopLikedResponse>, ApiError> {
    let valid_types = ["post", "video", "photo"];
    if !valid_types.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo",
            target_type
        )));
    }

    let limit = query.limit.unwrap_or(10).min(50).max(1);

    let service = LikeService::new(state.db.clone());
    let items = service.top_liked(&target_type, limit).await?;

    let results: Vec<TopLikedItem> = items
        .into_iter()
        .map(|(id, count)| TopLikedItem {
            target_id: id,
            like_count: count,
        })
        .collect();

    Ok(Json(TopLikedResponse {
        target_type,
        items: results,
    }))
}

// ─── Request / Response Types ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TopLikedQuery {
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct TopLikedResponse {
    pub target_type: String,
    pub items: Vec<TopLikedItem>,
}

#[derive(Debug, Serialize)]
pub struct TopLikedItem {
    pub target_id: String,
    pub like_count: i64,
}
