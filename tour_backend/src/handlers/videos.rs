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
    models::user::UserRole,
    models::video::Video,
    services::VideoService,
    AppState,
};

// ─── Query / Input Types ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVideosQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub region_id: Option<String>,
    pub platform: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVideoInput {
    pub title: String,
    pub description: Option<String>,
    pub platform: Option<String>,
    pub video_url: String,
    pub video_id: Option<String>,
    pub thumbnail_url: Option<String>,
    pub duration: Option<i32>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVideoInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub video_url: Option<String>,
    pub video_id: Option<String>,
    pub thumbnail_url: Option<String>,
    pub duration: Option<i32>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrashQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

// ─── Video CRUD Handlers ─────────────────────────────────────────────────────

/// List videos (public — defaults to published only unless editor/admin provides status filter).
///
/// **Public users** (unauthenticated or non-editor/admin) only see published videos.
/// The `status` query parameter is ignored for public users — this prevents
/// accidental or intentional exposure of draft content.
///
/// **Editors / Admins** can filter by any status via the query parameter.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListVideosQuery>,
) -> Result<Json<PaginatedResponse<Video>>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());

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

    let (videos, total) = service
        .list(
            page,
            limit,
            effective_status.as_deref(),
            query.region_id.as_deref(),
            query.platform.as_deref(),
            query.is_featured,
        )
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: videos,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get a video by slug.
///
/// **Public users** only see published videos. If a draft video matches
/// the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view videos in any status (needed for the edit
/// dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<Video>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());

    let video = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Video with slug '{}' not found", slug)))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && video.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Video with slug '{}' not found",
            slug
        )));
    }

    Ok(Json(video))
}

/// Get a video by ID.
///
/// **Public users** only see published videos. If a draft video matches
/// the ID, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view videos in any status.
pub async fn get_by_id(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(id): Path<String>,
) -> Result<Json<Video>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());

    let video = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && video.status != ContentStatus::Published {
        return Err(ApiError::NotFound("Video not found".to_string()));
    }

    Ok(Json(video))
}

/// Create a new video (requires active editor or admin).
pub async fn create(
    State(state): State<AppState>,
    user: ActiveEditorUser,
    Json(input): Json<CreateVideoInput>,
) -> Result<Json<Video>, ApiError> {
    if input.title.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Title cannot be empty".to_string(),
        ));
    }

    if input.video_url.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Video URL cannot be empty".to_string(),
        ));
    }

    let platform = input.platform.as_deref().unwrap_or("youtube");
    let valid_platforms = ["youtube", "vimeo", "tiktok"];
    if !valid_platforms.contains(&platform) {
        return Err(ApiError::ValidationError(format!(
            "Invalid platform '{}'. Must be one of: youtube, vimeo, tiktok",
            platform
        )));
    }

    // Auto-extract video_id and thumbnail for YouTube URLs if not provided
    let auto_video_id = if input.video_id.is_none() && platform == "youtube" {
        VideoService::extract_youtube_id(&input.video_url)
    } else {
        None
    };

    let video_id_str = input.video_id.as_deref().or(auto_video_id.as_deref());

    let auto_thumbnail = if input.thumbnail_url.is_none() {
        video_id_str.map(VideoService::youtube_thumbnail_url)
    } else {
        None
    };

    let thumbnail_url = input.thumbnail_url.as_deref().or(auto_thumbnail.as_deref());

    let service = VideoService::new(state.db.clone(), state.cache.clone());
    let normalized_region_id = input
        .region_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let video = service
        .create(
            &user.0.id,
            input.title.trim(),
            input.description.as_deref(),
            platform,
            input.video_url.trim(),
            video_id_str,
            thumbnail_url,
            input.duration,
            normalized_region_id,
            input.is_featured.unwrap_or(false),
        )
        .await?;

    Ok(Json(video))
}

/// Update an existing video (author or admin).
pub async fn update(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateVideoInput>,
) -> Result<Json<Video>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());

    // Check existence and permission
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))?;

    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }
    let normalized_region_id = input
        .region_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let video = service
        .update(
            &id,
            input.title.as_deref(),
            input.description.as_deref(),
            input.video_url.as_deref(),
            input.video_id.as_deref(),
            input.thumbnail_url.as_deref(),
            input.duration,
            normalized_region_id,
            input.is_featured,
            input.status.as_deref(),
        )
        .await?;

    Ok(Json(video))
}

/// Update video status (admin only).
pub async fn update_status(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<Video>, ApiError> {
    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("Missing 'status' field".to_string()))?;

    if status != "draft" && status != "published" {
        return Err(ApiError::BadRequest(
            "Status must be 'draft' or 'published'".to_string(),
        ));
    }

    let service = VideoService::new(state.db.clone(), state.cache.clone());
    let video = service.update_status(&id, status).await?;

    Ok(Json(video))
}

/// Soft delete a video (author or admin).
pub async fn delete(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Video not found".to_string()))?;

    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    service.delete(&id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Restore a soft-deleted video (admin only).
pub async fn restore(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Video>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());
    let video = service.restore(&id).await?;
    Ok(Json(video))
}

/// Hard delete a video permanently (admin only — for trash cleanup).
pub async fn hard_delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());
    service.hard_delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// List soft-deleted videos (admin trash view).
pub async fn list_deleted(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<TrashQuery>,
) -> Result<Json<PaginatedResponse<Video>>, ApiError> {
    let service = VideoService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(10).min(100).max(1);

    let (videos, total) = service.list_deleted(page, limit).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: videos,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Update display order for a video (admin).
pub async fn update_display_order(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<Video>, ApiError> {
    let display_order = body
        .get("display_order")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);

    let service = VideoService::new(state.db.clone(), state.cache.clone());
    let video = service.update_display_order(&id, display_order).await?;

    Ok(Json(video))
}
