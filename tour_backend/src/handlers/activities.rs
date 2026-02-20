use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::{ActiveEditorUser, AdminUser, OptionalUser},
    handlers::posts::PaginatedResponse,
    models::common::ContentStatus,
    models::post::Post,
    models::user::UserRole,
    services::ActivityService,
    utils::validation::sanitize_rich_html,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListActivitiesQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateActivityInput {
    pub title: String,
    pub short_description: Option<String>,
    pub content: Option<String>,
    pub cover_image: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateActivityInput {
    pub title: Option<String>,
    pub short_description: Option<String>,
    pub content: Option<String>,
    pub cover_image: Option<String>,
    pub is_featured: Option<bool>,
    pub status: Option<String>,
}

/// List activities (public — defaults to published only unless editor/admin).
///
/// **Public users** (unauthenticated or non-editor/admin) only see published
/// activities (`is_active` is forced to `true`). The `is_active` query
/// parameter is ignored for public users — this prevents accidental or
/// intentional exposure of draft content.
///
/// **Editors / Admins** can filter by any `is_active` value.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListActivitiesQuery>,
) -> Result<Json<PaginatedResponse<Post>>, ApiError> {
    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    // Determine effective is_active filter based on the caller's role.
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    let effective_is_active: Option<bool> = if is_privileged {
        // Editors/admins can use whatever filter they want
        query.is_active
    } else {
        // Public users always see only published (is_active=true) activities
        Some(true)
    };

    let (activities, total) = service.list(page, limit, effective_is_active).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: activities,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get an activity by slug.
///
/// **Public users** only see published activities. If a draft activity
/// matches the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view activities in any status (needed for the
/// edit dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<Post>, ApiError> {
    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let activity = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Activity with slug '{}' not found", slug)))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && activity.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Activity with slug '{}' not found",
            slug
        )));
    }

    Ok(Json(activity))
}

pub async fn create(
    State(state): State<AppState>,
    user: ActiveEditorUser,
    Json(input): Json<CreateActivityInput>,
) -> Result<Json<Post>, ApiError> {
    if input.title.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Title cannot be empty".to_string(),
        ));
    }

    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let activity = service
        .create(
            &user.0.id,
            &input.title,
            input.short_description.as_deref(),
            input.content.as_deref().map(sanitize_rich_html).as_deref(),
            input.cover_image.as_deref(),
            input.is_featured.unwrap_or(false),
        )
        .await?;

    Ok(Json(activity))
}

pub async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(slug): Path<String>,
    Json(input): Json<UpdateActivityInput>,
) -> Result<Json<Post>, ApiError> {
    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Activity with slug '{}' not found", slug)))?;

    // Sanitize rich HTML content before storage (defence-in-depth)
    let mut sanitized_input = input;
    if let Some(ref content) = sanitized_input.content {
        sanitized_input.content = Some(sanitize_rich_html(content));
    }

    let activity = service.update(&existing.id, sanitized_input).await?;

    Ok(Json(activity))
}

pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = ActivityService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Activity with slug '{}' not found", slug)))?;

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
