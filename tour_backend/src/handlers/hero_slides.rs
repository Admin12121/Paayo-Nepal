use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::AdminUser,
    models::hero_slide::{HeroSlide, HeroSlideResolved},
    services::HeroSlideService,
    AppState,
};

// ─── Input Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateHeroSlideInput {
    pub content_type: String,
    pub content_id: Option<String>,
    pub custom_title: Option<String>,
    pub custom_description: Option<String>,
    pub custom_image: Option<String>,
    pub custom_link: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHeroSlideInput {
    pub content_type: Option<String>,
    pub content_id: Option<String>,
    pub custom_title: Option<String>,
    pub custom_description: Option<String>,
    pub custom_image: Option<String>,
    pub custom_link: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderInput {
    /// List of (slide_id, new_sort_order) pairs.
    pub orders: Vec<ReorderItem>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderItem {
    pub id: String,
    pub sort_order: i32,
}

// ─── Public Handlers ─────────────────────────────────────────────────────────

/// List active hero slides resolved with their linked content data (public).
/// This is what the frontend homepage consumes to render the hero carousel.
pub async fn list_resolved(
    State(state): State<AppState>,
) -> Result<Json<Vec<HeroSlideResolved>>, ApiError> {
    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());
    let slides = service.list_resolved().await?;
    Ok(Json(slides))
}

// ─── Admin Handlers ──────────────────────────────────────────────────────────

/// List ALL hero slides (admin — includes inactive and scheduled).
pub async fn list_all(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<Vec<HeroSlide>>, ApiError> {
    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());
    let slides = service.list(false).await?;
    Ok(Json(slides))
}

/// Get a single hero slide by ID (admin).
pub async fn get_by_id(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<HeroSlide>, ApiError> {
    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());

    let slide = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hero slide not found".to_string()))?;

    Ok(Json(slide))
}

/// Create a new hero slide (admin only).
pub async fn create(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<CreateHeroSlideInput>,
) -> Result<Json<HeroSlide>, ApiError> {
    // Validate content_type
    let valid_types = ["post", "video", "photo", "custom"];
    if !valid_types.contains(&input.content_type.as_str()) {
        return Err(ApiError::ValidationError(format!(
            "Invalid content_type '{}'. Must be one of: post, video, photo, custom",
            input.content_type
        )));
    }

    // Non-custom slides must have a content_id
    if input.content_type != "custom" && input.content_id.is_none() {
        return Err(ApiError::ValidationError(
            "content_id is required for non-custom hero slides".to_string(),
        ));
    }

    // Custom slides should have at least a title or image
    if input.content_type == "custom"
        && input.custom_title.is_none()
        && input.custom_image.is_none()
    {
        return Err(ApiError::ValidationError(
            "Custom hero slides must have at least a custom_title or custom_image".to_string(),
        ));
    }

    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());

    let slide = service
        .create(
            &input.content_type,
            input.content_id.as_deref(),
            input.custom_title.as_deref(),
            input.custom_description.as_deref(),
            input.custom_image.as_deref(),
            input.custom_link.as_deref(),
            input.sort_order,
            input.is_active.unwrap_or(true),
            input.starts_at.as_deref(),
            input.ends_at.as_deref(),
        )
        .await?;

    Ok(Json(slide))
}

/// Update an existing hero slide (admin only).
pub async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateHeroSlideInput>,
) -> Result<Json<HeroSlide>, ApiError> {
    // Validate content_type if provided
    if let Some(ref ct) = input.content_type {
        let valid_types = ["post", "video", "photo", "custom"];
        if !valid_types.contains(&ct.as_str()) {
            return Err(ApiError::ValidationError(format!(
                "Invalid content_type '{}'. Must be one of: post, video, photo, custom",
                ct
            )));
        }
    }

    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());

    let slide = service
        .update(
            &id,
            input.content_type.as_deref(),
            input.content_id.as_deref(),
            input.custom_title.as_deref(),
            input.custom_description.as_deref(),
            input.custom_image.as_deref(),
            input.custom_link.as_deref(),
            input.sort_order,
            input.is_active,
            input.starts_at.as_deref(),
            input.ends_at.as_deref(),
        )
        .await?;

    Ok(Json(slide))
}

/// Delete a hero slide (admin only).
pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());
    service.delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Toggle active status for a hero slide (admin only).
pub async fn toggle_active(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<HeroSlide>, ApiError> {
    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());
    let slide = service.toggle_active(&id).await?;
    Ok(Json(slide))
}

/// Reorder hero slides (admin only).
/// Accepts a list of { id, sort_order } pairs and updates them all.
pub async fn reorder(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<ReorderInput>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if input.orders.is_empty() {
        return Err(ApiError::ValidationError(
            "orders list cannot be empty".to_string(),
        ));
    }

    let pairs: Vec<(String, i32)> = input
        .orders
        .into_iter()
        .map(|item| (item.id, item.sort_order))
        .collect();

    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());
    service.reorder(&pairs).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Get hero slide counts (admin — for dashboard stats).
pub async fn counts(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = HeroSlideService::new(state.db.clone(), state.cache.clone());

    let total = service.count().await?;
    let active = service.count_active().await?;

    Ok(Json(serde_json::json!({
        "total": total,
        "active": active,
        "inactive": total - active,
    })))
}
