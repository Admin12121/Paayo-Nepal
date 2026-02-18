use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::{AdminUser, OptionalUser},
    handlers::posts::PaginatedResponse,
    models::common::ContentStatus,
    models::post::Post,
    models::region::Region,
    models::user::UserRole,
    services::AttractionService,
    services::RegionService,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListRegionsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub province: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRegionInput {
    pub name: String,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub is_featured: Option<bool>,
    pub province: Option<String>,
    pub district: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub map_data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegionInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub is_featured: Option<bool>,
    pub status: Option<String>,
    pub province: Option<String>,
    pub district: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub map_data: Option<serde_json::Value>,
}

/// List regions.
///
/// **Public users** (unauthenticated or non-editor/admin) only see published regions.
/// The `status` query parameter is ignored for public users — this prevents
/// accidental or intentional exposure of draft content.
///
/// **Editors / Admins** can filter by any status via the query parameter.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListRegionsQuery>,
) -> Result<Json<PaginatedResponse<Region>>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    // Determine effective status filter based on the caller's role.
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    let effective_status: Option<String> = if is_privileged {
        query.status.clone()
    } else {
        Some("published".to_string())
    };

    let (regions, total) = service
        .list(
            page,
            limit,
            effective_status.as_deref(),
            query.province.as_deref(),
        )
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: regions,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get a region by slug.
///
/// **Public users** only see published regions. If a draft region matches
/// the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view regions in any status (needed for the edit
/// dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<Region>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let region = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && region.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Region with slug '{}' not found",
            slug
        )));
    }

    Ok(Json(region))
}

pub async fn create(
    State(state): State<AppState>,
    admin: AdminUser,
    Json(input): Json<CreateRegionInput>,
) -> Result<Json<Region>, ApiError> {
    if input.name.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Region name cannot be empty".to_string(),
        ));
    }

    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let region = service
        .create(
            &admin.0.id,
            &input.name,
            input.description.as_deref(),
            input.cover_image.as_deref(),
            input.is_featured.unwrap_or(false),
            input.province.as_deref(),
            input.district.as_deref(),
            input.latitude,
            input.longitude,
            input.map_data,
        )
        .await?;

    Ok(Json(region))
}

pub async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(slug): Path<String>,
    Json(input): Json<UpdateRegionInput>,
) -> Result<Json<Region>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    let region = service.update(&existing.id, input).await?;

    Ok(Json(region))
}

pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Deserialize)]
pub struct RegionAttractionsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

pub async fn attractions(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<RegionAttractionsQuery>,
) -> Result<Json<PaginatedResponse<Post>>, ApiError> {
    let region_service = RegionService::new(state.db.clone(), state.cache.clone());

    // Get region to verify it exists and get the ID
    let region = region_service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    let attraction_service = AttractionService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    let (attractions, total) = attraction_service
        .list(page, limit, Some(&region.id), None, Some("published"))
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: attractions,
        total,
        page,
        limit,
        total_pages,
    }))
}
