use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::{ActiveEditorUser, AdminUser, AuthenticatedUser, OptionalUser},
    handlers::posts::PaginatedResponse,
    models::common::ContentStatus,
    models::post::Post,
    models::user::UserRole,
    services::EventService,
    utils::pagination::PaginationParams,
    utils::validation::sanitize_rich_html,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub region_id: Option<String>,
    pub featured: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventInput {
    pub title: String,
    pub short_description: Option<String>,
    pub content: Option<String>,
    pub cover_image: Option<String>,
    pub event_date: Option<String>,
    pub event_end_date: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEventInput {
    pub title: Option<String>,
    pub short_description: Option<String>,
    pub content: Option<String>,
    pub cover_image: Option<String>,
    pub event_date: Option<String>,
    pub event_end_date: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    pub status: Option<String>,
}

/// List events (public — defaults to published only unless editor/admin provides status filter).
///
/// **Public users** (unauthenticated or non-editor/admin) only see published events.
/// The `status` query parameter is ignored for public users — this prevents
/// accidental or intentional exposure of draft content.
///
/// **Editors / Admins** can filter by any status via the query parameter.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListEventsQuery>,
) -> Result<Json<PaginatedResponse<Post>>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(10).min(100).max(1);

    // Determine effective status filter based on the caller's role.
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    let effective_status: Option<String> = if is_privileged {
        query.status.clone()
    } else {
        Some("published".to_string())
    };

    let (events, total) = service
        .list(
            page,
            limit,
            query.region_id.as_deref(),
            query.featured,
            effective_status.as_deref(),
        )
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
) -> Result<Json<PaginatedResponse<Post>>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(10).min(100).max(1);

    let (events, total) = service.upcoming(page, limit).await?;
    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: events,
        total,
        page: query.page.unwrap_or(1),
        limit,
        total_pages,
    }))
}

/// Get an event by slug.
///
/// **Public users** only see published events. If a draft event matches
/// the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view events in any status (needed for the edit
/// dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<Post>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let event = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Event with slug '{}' not found", slug)))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && event.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Event with slug '{}' not found",
            slug
        )));
    }

    // View counting is handled exclusively by the frontend ViewTracker component,
    // which calls POST /views → ViewService::record_view() with 24h dedup.
    // Do NOT increment view_count here — that would double-count every page load.

    Ok(Json(event))
}

pub async fn create(
    State(state): State<AppState>,
    user: ActiveEditorUser,
    Json(input): Json<CreateEventInput>,
) -> Result<Json<Post>, ApiError> {
    if input.title.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Title cannot be empty".to_string(),
        ));
    }

    let service = EventService::new(state.db.clone(), state.cache.clone());

    let event = service
        .create(
            &user.0.id,
            &input.title,
            input.short_description.as_deref(),
            input.content.as_deref().map(sanitize_rich_html).as_deref(),
            input.cover_image.as_deref(),
            input.event_date.as_deref(),
            input.event_end_date.as_deref(),
            input.region_id.as_deref(),
            input.is_featured.unwrap_or(false),
        )
        .await?;

    Ok(Json(event))
}

pub async fn update(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(slug): Path<String>,
    Json(input): Json<UpdateEventInput>,
) -> Result<Json<Post>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Event with slug '{}' not found", slug)))?;

    // Only admin or creator can update
    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    // Sanitize rich HTML content before storage (defence-in-depth)
    let mut sanitized_input = input;
    if let Some(ref content) = sanitized_input.content {
        sanitized_input.content = Some(sanitize_rich_html(content));
    }

    let event = service.update(&existing.id, sanitized_input).await?;

    Ok(Json(event))
}

pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = EventService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Event with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
