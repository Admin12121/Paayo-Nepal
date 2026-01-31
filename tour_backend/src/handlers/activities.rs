use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError, extractors::auth::AuthenticatedUser, handlers::posts::PaginatedResponse,
    middleware::auth::UserRole, models::activity::Activity, services::ActivityService, AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListActivitiesQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateActivityInput {
    pub name: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub hero_image: Option<String>,
    pub icon: Option<String>,
    pub display_order: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateActivityInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub hero_image: Option<String>,
    pub icon: Option<String>,
    pub display_order: Option<i32>,
    pub is_active: Option<bool>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListActivitiesQuery>,
) -> Result<Json<PaginatedResponse<Activity>>, ApiError> {
    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (activities, total) = service.list(page, limit, query.is_active).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: activities,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn get_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Activity>, ApiError> {
    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let activity = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Activity with slug '{}' not found", slug)))?;

    Ok(Json(activity))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(input): Json<CreateActivityInput>,
) -> Result<Json<Activity>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let activity = service
        .create(
            &input.name,
            input.description.as_deref(),
            input.content.as_deref(),
            input.featured_image.as_deref(),
            input.hero_image.as_deref(),
            input.icon.as_deref(),
            input.display_order,
            input.is_active.unwrap_or(true),
            &user.id,
        )
        .await?;

    Ok(Json(activity))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
    Json(input): Json<UpdateActivityInput>,
) -> Result<Json<Activity>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Activity with slug '{}' not found", slug)))?;

    let activity = service.update(&existing.id, input).await?;

    Ok(Json(activity))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Activity with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
