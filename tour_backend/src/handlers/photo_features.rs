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
    models::photo_feature::{PhotoFeature, PhotoFeatureWithImages, PhotoImage},
    models::user::UserRole,
    services::PhotoFeatureService,
    AppState,
};

// ─── Query / Input Types ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPhotosQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePhotoFeatureInput {
    pub title: String,
    pub description: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    /// Optional initial images to add: list of (image_url, caption) pairs.
    pub images: Option<Vec<ImageInput>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePhotoFeatureInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImageInput {
    pub image_url: String,
    pub caption: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddImageInput {
    pub image_url: String,
    pub caption: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateImageInput {
    pub caption: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderImagesInput {
    pub image_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrashQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

// ─── Photo Feature CRUD Handlers ─────────────────────────────────────────────

/// List photo features (public — defaults to published only unless editor/admin provides status filter).
///
/// **Public users** (unauthenticated or non-editor/admin) only see published photo features.
/// The `status` query parameter is ignored for public users — this prevents
/// accidental or intentional exposure of draft content.
///
/// **Editors / Admins** can filter by any status via the query parameter.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListPhotosQuery>,
) -> Result<Json<PaginatedResponse<PhotoFeature>>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

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

    let (photos, total) = service
        .list(
            page,
            limit,
            effective_status.as_deref(),
            query.region_id.as_deref(),
            query.is_featured,
        )
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: photos,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get a photo feature by slug with its images.
///
/// **Public users** only see published photo features. If a draft photo
/// feature matches the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view photo features in any status (needed for the
/// edit dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<PhotoFeatureWithImages>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    let result = service
        .get_with_images_by_slug(&slug)
        .await?
        .ok_or_else(|| {
            ApiError::NotFound(format!("Photo feature with slug '{}' not found", slug))
        })?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && result.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Photo feature with slug '{}' not found",
            slug
        )));
    }

    Ok(Json(result))
}

/// Get a photo feature by ID with its images.
///
/// **Public users** only see published photo features. If a draft photo
/// feature matches the ID, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view photo features in any status.
pub async fn get_by_id(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(id): Path<String>,
) -> Result<Json<PhotoFeatureWithImages>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    let result = service
        .get_with_images(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && result.status != ContentStatus::Published {
        return Err(ApiError::NotFound("Photo feature not found".to_string()));
    }

    Ok(Json(result))
}

/// Create a new photo feature (requires active editor or admin).
/// Optionally accepts initial images in the same request.
pub async fn create(
    State(state): State<AppState>,
    user: AdminUser,
    Json(input): Json<CreatePhotoFeatureInput>,
) -> Result<Json<PhotoFeatureWithImages>, ApiError> {
    if input.title.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Title cannot be empty".to_string(),
        ));
    }

    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    let normalized_region_id = input
        .region_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());

    let photo = service
        .create(
            &user.0.id,
            input.title.trim(),
            input.description.as_deref(),
            normalized_region_id,
            input.is_featured.unwrap_or(false),
        )
        .await?;

    // If initial images were provided, batch add them
    if let Some(images) = &input.images {
        if !images.is_empty() {
            let image_pairs: Vec<(String, Option<String>)> = images
                .iter()
                .map(|img| (img.image_url.clone(), img.caption.clone()))
                .collect();
            service.batch_add_images(&photo.id, &image_pairs).await?;
        }
    }

    // Return the photo feature with its images
    let result = service
        .get_with_images(&photo.id)
        .await?
        .ok_or(ApiError::InternalServerError)?;

    Ok(Json(result))
}

/// Update an existing photo feature (author or admin).
pub async fn update(
    State(state): State<AppState>,
    _user: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<UpdatePhotoFeatureInput>,
) -> Result<Json<PhotoFeature>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))?;

    let normalized_region_id = input
        .region_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());

    let photo = service
        .update(
            &id,
            input.title.as_deref(),
            input.description.as_deref(),
            normalized_region_id,
            input.is_featured,
            input.status.as_deref(),
        )
        .await?;

    Ok(Json(photo))
}

/// Update photo feature status (admin only).
pub async fn update_status(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<PhotoFeature>, ApiError> {
    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("Missing 'status' field".to_string()))?;

    if status != "draft" && status != "published" {
        return Err(ApiError::BadRequest(
            "Status must be 'draft' or 'published'".to_string(),
        ));
    }

    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    let photo = service.update_status(&id, status).await?;

    Ok(Json(photo))
}

/// Soft delete a photo feature (author or admin).
pub async fn delete(
    State(state): State<AppState>,
    _user: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))?;

    service.delete(&id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Restore a soft-deleted photo feature (admin only).
pub async fn restore(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<PhotoFeature>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    let photo = service.restore(&id).await?;
    Ok(Json(photo))
}

/// Hard delete a photo feature permanently (admin only — for trash cleanup).
pub async fn hard_delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    service.hard_delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// List soft-deleted photo features (admin trash view).
pub async fn list_deleted(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<TrashQuery>,
) -> Result<Json<PaginatedResponse<PhotoFeature>>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(10).min(100).max(1);

    let (photos, total) = service.list_deleted(page, limit).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: photos,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Update display order for a photo feature (admin).
pub async fn update_display_order(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<PhotoFeature>, ApiError> {
    let display_order = body
        .get("display_order")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);

    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    let photo = service.update_display_order(&id, display_order).await?;

    Ok(Json(photo))
}

// ─── Image Handlers ──────────────────────────────────────────────────────────

/// List images for a photo feature (public).
pub async fn list_images(
    State(state): State<AppState>,
    Path(photo_id): Path<String>,
) -> Result<Json<Vec<PhotoImage>>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    // Verify the photo feature exists
    service
        .get_by_id(&photo_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))?;

    let images = service.list_images(&photo_id).await?;
    Ok(Json(images))
}

/// Add an image to a photo feature (admin/editor).
pub async fn add_image(
    State(state): State<AppState>,
    user: ActiveEditorUser,
    Path(photo_id): Path<String>,
    Json(input): Json<AddImageInput>,
) -> Result<Json<PhotoImage>, ApiError> {
    if input.image_url.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Image URL cannot be empty".to_string(),
        ));
    }

    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    let image = service
        .add_image(
            &photo_id,
            Some(&user.0.id),
            input.image_url.trim(),
            input.caption.as_deref(),
            input.display_order,
        )
        .await?;

    Ok(Json(image))
}

/// Update an image's caption or display order (admin/editor).
pub async fn update_image(
    State(state): State<AppState>,
    _user: ActiveEditorUser,
    Path((_photo_id, image_id)): Path<(String, String)>,
    Json(input): Json<UpdateImageInput>,
) -> Result<Json<PhotoImage>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());

    let image = service
        .update_image(&image_id, input.caption.as_deref(), input.display_order)
        .await?;

    Ok(Json(image))
}

/// Remove an image from a photo feature (admin/editor).
pub async fn remove_image(
    State(state): State<AppState>,
    _user: ActiveEditorUser,
    Path((_photo_id, image_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    service.remove_image(&image_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Reorder images within a photo feature (admin/editor).
/// Accepts a list of image IDs in the desired order.
pub async fn reorder_images(
    State(state): State<AppState>,
    _user: ActiveEditorUser,
    Path(photo_id): Path<String>,
    Json(input): Json<ReorderImagesInput>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if input.image_ids.is_empty() {
        return Err(ApiError::ValidationError(
            "image_ids cannot be empty".to_string(),
        ));
    }

    let service = PhotoFeatureService::new(state.db.clone(), state.cache.clone());
    service.reorder_images(&photo_id, &input.image_ids).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
