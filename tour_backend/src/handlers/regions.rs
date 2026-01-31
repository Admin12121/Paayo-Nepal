use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::AuthenticatedUser,
    handlers::posts::PaginatedResponse,
    middleware::auth::UserRole,
    models::{attraction::Attraction, region::Region},
    services::RegionService,
    utils::pagination::PaginationParams,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListRegionsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub province: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRegionInput {
    pub name: String,
    pub description: Option<String>,
    pub featured_image: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub province: Option<String>,
    pub district: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegionInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub featured_image: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub province: Option<String>,
    pub district: Option<String>,
    pub display_order: Option<i32>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListRegionsQuery>,
) -> Result<Json<PaginatedResponse<Region>>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (regions, total) = service.list(page, limit, query.province.as_deref()).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: regions,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn get_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Region>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let region = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    Ok(Json(region))
}

pub async fn attractions(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<Attraction>>, ApiError> {
    let service = RegionService::new(state.db.clone(), state.cache.clone());

    // First get the region
    let region = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    let (attractions, total) = service
        .get_attractions(
            &region.id,
            query.page.unwrap_or(1),
            query.limit.unwrap_or(20),
        )
        .await?;

    let limit = query.limit.unwrap_or(20);
    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: attractions,
        total,
        page: query.page.unwrap_or(1),
        limit,
        total_pages,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(input): Json<CreateRegionInput>,
) -> Result<Json<Region>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let region = service
        .create(
            &input.name,
            input.description.as_deref(),
            input.featured_image.as_deref(),
            input.latitude,
            input.longitude,
            input.province.as_deref(),
            input.district.as_deref(),
            input.display_order,
            &user.id,
        )
        .await?;

    Ok(Json(region))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
    Json(input): Json<UpdateRegionInput>,
) -> Result<Json<Region>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

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
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = RegionService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Region with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
