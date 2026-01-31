use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError, extractors::auth::AuthenticatedUser, handlers::posts::PaginatedResponse,
    middleware::auth::UserRole, models::attraction::Attraction, services::AttractionService,
    utils::pagination::PaginationParams, AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListAttractionsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub region_id: Option<String>,
    pub is_top: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAttractionInput {
    pub name: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub region_id: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address: Option<String>,
    pub opening_hours: Option<serde_json::Value>,
    pub entry_fee: Option<String>,
    pub is_top_attraction: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAttractionInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub region_id: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address: Option<String>,
    pub opening_hours: Option<serde_json::Value>,
    pub entry_fee: Option<String>,
    pub is_top_attraction: Option<bool>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListAttractionsQuery>,
) -> Result<Json<PaginatedResponse<Attraction>>, ApiError> {
    let service = AttractionService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (attractions, total) = service
        .list(page, limit, query.region_id.as_deref(), query.is_top)
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

pub async fn top(
    State(state): State<AppState>,
    Query(query): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<Attraction>>, ApiError> {
    let service = AttractionService::new(state.db.clone(), state.cache.clone());

    let (attractions, total) = service
        .top(query.page.unwrap_or(1), query.limit.unwrap_or(10))
        .await?;

    let limit = query.limit.unwrap_or(10);
    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: attractions,
        total,
        page: query.page.unwrap_or(1),
        limit,
        total_pages,
    }))
}

pub async fn get_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Attraction>, ApiError> {
    let service = AttractionService::new(state.db.clone(), state.cache.clone());

    let attraction = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Attraction with slug '{}' not found", slug)))?;

    // Increment view count
    let db = state.db.clone();
    let attraction_id = attraction.id.clone();
    tokio::spawn(async move {
        let _ = sqlx::query("UPDATE attractions SET views = views + 1 WHERE id = ?")
            .bind(&attraction_id)
            .execute(&db)
            .await;
    });

    Ok(Json(attraction))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(input): Json<CreateAttractionInput>,
) -> Result<Json<Attraction>, ApiError> {
    if user.role == UserRole::User {
        return Err(ApiError::Forbidden);
    }
    if user.role != UserRole::Admin && !user.is_active {
        return Err(ApiError::Forbidden);
    }

    let service = AttractionService::new(state.db.clone(), state.cache.clone());

    let attraction = service
        .create(
            &input.name,
            input.description.as_deref(),
            input.content.as_deref(),
            input.featured_image.as_deref(),
            input.region_id.as_deref(),
            input.latitude,
            input.longitude,
            input.address.as_deref(),
            input.opening_hours.as_ref(),
            input.entry_fee.as_deref(),
            input.is_top_attraction.unwrap_or(false),
            &user.id,
        )
        .await?;

    Ok(Json(attraction))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
    Json(input): Json<UpdateAttractionInput>,
) -> Result<Json<Attraction>, ApiError> {
    if user.role == UserRole::User {
        return Err(ApiError::Forbidden);
    }
    if user.role != UserRole::Admin && !user.is_active {
        return Err(ApiError::Forbidden);
    }

    let service = AttractionService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Attraction with slug '{}' not found", slug)))?;

    // Only admin or creator can update
    if existing.created_by != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let attraction = service.update(&existing.id, input).await?;

    Ok(Json(attraction))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = AttractionService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Attraction with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
