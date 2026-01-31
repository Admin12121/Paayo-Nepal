use axum::{
    extract::{Multipart, Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;
use tracing::info;

use crate::{
    error::ApiError,
    extractors::auth::AuthenticatedUser,
    handlers::posts::PaginatedResponse,
    middleware::auth::UserRole,
    models::media::Media,
    services::{MediaService, NotificationService},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListMediaQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub media_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GalleryQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub featured: Option<bool>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListMediaQuery>,
) -> Result<Json<PaginatedResponse<Media>>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (media, total) = service
        .list(page, limit, query.media_type.as_deref())
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: media,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn gallery(
    State(state): State<AppState>,
    Query(query): Query<GalleryQuery>,
) -> Result<Json<PaginatedResponse<Media>>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (media, total) = service.gallery(page, limit, query.featured).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: media,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Media>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    let media = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Media not found".to_string()))?;

    Ok(Json(media))
}

pub async fn upload(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> Result<Json<Media>, ApiError> {
    // Only active editors and admins can upload
    if user.role == UserRole::User {
        return Err(ApiError::Forbidden);
    }
    if user.role != UserRole::Admin && !user.is_active {
        return Err(ApiError::Forbidden);
    }

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
    {
        let file_name = field
            .file_name()
            .ok_or_else(|| ApiError::BadRequest("No filename provided".to_string()))?
            .to_string();

        let content_type = field
            .content_type()
            .ok_or_else(|| ApiError::BadRequest("No content type provided".to_string()))?
            .to_string();

        // Validate file type - accept common image formats, will convert to AVIF
        let allowed_types = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
        ];
        if !allowed_types.contains(&content_type.as_str()) {
            return Err(ApiError::BadRequest(format!(
                "Invalid file type: {}. Allowed: JPEG, PNG, WebP, GIF, AVIF",
                content_type
            )));
        }

        let data = field
            .bytes()
            .await
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        // Validate file size (max 10MB for uploads)
        const MAX_UPLOAD_SIZE: usize = 10 * 1024 * 1024; // 10MB
        if data.len() > MAX_UPLOAD_SIZE {
            return Err(ApiError::BadRequest(format!(
                "File too large. Maximum size: 10MB (received: {:.2}MB)",
                data.len() as f64 / 1024.0 / 1024.0
            )));
        }

        info!(
            "Processing image upload: {} ({} bytes)",
            file_name,
            data.len()
        );

        // Process image with AVIF conversion
        let processed = state
            .image_service
            .process_image(&data, &file_name)
            .await
            .map_err(|_| ApiError::InternalServerError)?;

        info!(
            "Image processed: {} ({}x{}), blur: {}",
            processed.filename, processed.width, processed.height, processed.blur_hash
        );

        // Save to database
        let media_service = MediaService::new(state.db.clone(), state.cache.clone());
        let media = media_service
            .create(
                &processed.filename,
                &file_name,
                &processed.mime_type,
                processed.size as i64,
                processed.width as i32,
                processed.height as i32,
                &processed.blur_hash,
                &processed.thumbnail_filename,
                &user.id,
            )
            .await?;

        info!("Media record created: {}", media.id);

        // Notify admins about new media upload
        let notif_service = NotificationService::with_redis(state.db.clone(), state.redis.clone());
        let uploader_name = user.name.as_deref().unwrap_or(&user.email);
        let _ = notif_service
            .notify_admins(
                "new_content",
                "New Media Uploaded",
                Some(&format!(
                    "{} uploaded a new file: {}",
                    uploader_name, media.original_name
                )),
                Some("/dashboard/media"),
            )
            .await;

        return Ok(Json(media));
    }

    Err(ApiError::BadRequest("No file uploaded".to_string()))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    // Get existing media
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Media not found".to_string()))?;

    // Only admin or uploader can delete
    if existing.uploaded_by != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    info!("Deleting media: {} ({})", existing.id, existing.filename);

    // Delete files
    let thumbnail = existing.thumbnail_path.as_deref().unwrap_or("");
    state
        .image_service
        .delete_image(&existing.filename, thumbnail)
        .await
        .map_err(|e| {
            tracing::warn!("Failed to delete image files: {}", e);
            // Continue even if file deletion fails
        })
        .ok();

    // Delete from database
    service.delete(&id).await?;

    info!("Media deleted successfully: {}", existing.id);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Media deleted successfully"
    })))
}
