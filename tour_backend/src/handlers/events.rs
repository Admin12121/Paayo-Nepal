use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError, extractors::auth::AuthenticatedUser, handlers::posts::PaginatedResponse,
    middleware::auth::UserRole, models::event::Event, services::EventService,
    utils::pagination::PaginationParams, AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub region_id: Option<String>,
    pub featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventInput {
    pub title: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub location: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEventInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub location: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListEventsQuery>,
) -> Result<Json<PaginatedResponse<Event>>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(10);

    let (events, total) = service
        .list(page, limit, query.region_id.as_deref(), query.featured)
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: events,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn upcoming(
    State(state): State<AppState>,
    Query(query): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<Event>>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let (events, total) = service
        .upcoming(query.page.unwrap_or(1), query.limit.unwrap_or(10))
        .await?;

    let limit = query.limit.unwrap_or(10);
    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: events,
        total,
        page: query.page.unwrap_or(1),
        limit,
        total_pages,
    }))
}

pub async fn get_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Event>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let event = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Event with slug '{}' not found", slug)))?;

    // Increment view count
    let db = state.db.clone();
    let event_id = event.id.clone();
    tokio::spawn(async move {
        let _ = sqlx::query("UPDATE events SET views = views + 1 WHERE id = ?")
            .bind(&event_id)
            .execute(&db)
            .await;
    });

    Ok(Json(event))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(input): Json<CreateEventInput>,
) -> Result<Json<Event>, ApiError> {
    if user.role == UserRole::User {
        return Err(ApiError::Forbidden);
    }
    if user.role != UserRole::Admin && !user.is_active {
        return Err(ApiError::Forbidden);
    }

    let service = EventService::new(state.db.clone(), state.cache.clone());

    let event = service
        .create(
            &input.title,
            input.description.as_deref(),
            input.content.as_deref(),
            input.featured_image.as_deref(),
            &input.start_date,
            input.end_date.as_deref(),
            input.start_time.as_deref(),
            input.end_time.as_deref(),
            input.location.as_deref(),
            input.region_id.as_deref(),
            input.is_featured.unwrap_or(false),
            &user.id,
        )
        .await?;

    Ok(Json(event))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
    Json(input): Json<UpdateEventInput>,
) -> Result<Json<Event>, ApiError> {
    if user.role == UserRole::User {
        return Err(ApiError::Forbidden);
    }
    if user.role != UserRole::Admin && !user.is_active {
        return Err(ApiError::Forbidden);
    }

    let service = EventService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Event with slug '{}' not found", slug)))?;

    // Only admin or creator can update
    if existing.created_by != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let event = service.update(&existing.id, input).await?;

    Ok(Json(event))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = EventService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Event with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
