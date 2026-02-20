use axum::{
    extract::{Multipart, Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use crate::{
    error::ApiError,
    extractors::auth::{ActiveEditorUser, AdminUser, AuthenticatedUser, EditorUser},
    handlers::posts::PaginatedResponse,
    models::media::Media,
    services::{MediaCleanupService, MediaService, NotificationService},
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

/// List all media (editor/admin only — dashboard media library).
///
/// This endpoint exposes internal media metadata (filenames, upload paths,
/// uploader IDs). It must NOT be public — unauthenticated users should not
/// be able to enumerate the media library (V-010).
pub async fn list(
    State(state): State<AppState>,
    _user: EditorUser,
    Query(query): Query<ListMediaQuery>,
) -> Result<Json<PaginatedResponse<Media>>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

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

/// Gallery view of images (editor/admin only — dashboard media picker).
///
/// Like `list`, this exposes internal media metadata and should not be
/// accessible to unauthenticated users.
pub async fn gallery(
    State(state): State<AppState>,
    _user: EditorUser,
    Query(query): Query<GalleryQuery>,
) -> Result<Json<PaginatedResponse<Media>>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

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
    user: ActiveEditorUser,
    mut multipart: Multipart,
) -> Result<Json<Media>, ApiError> {
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

        // Validate file size (max 20MB for uploads).
        //
        // This limit must stay in sync with:
        //   - routes/media.rs  DefaultBodyLimit  → 22 MB (20MB file + multipart overhead)
        //   - Frontend validation                → 20 MB
        //   - nginx.conf  client_max_body_size   → 50 MB (generous; real cap is here)
        const MAX_UPLOAD_SIZE: usize = 20 * 1024 * 1024; // 20MB
        if data.len() > MAX_UPLOAD_SIZE {
            return Err(ApiError::BadRequest(format!(
                "File too large. Maximum size: 20MB (received: {:.2}MB)",
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
            .map_err(|e| {
                error!("Image processing failed for '{}': {:?}", file_name, e);
                ApiError::ImageError(format!("Image processing failed: {}", e))
            })?;

        info!(
            "Image processed: {} ({}x{}), blur: {}",
            processed.filename, processed.width, processed.height, processed.blur_hash
        );

        // Save to database — size is i32 in the schema
        let media_service = MediaService::new(state.db.clone(), state.cache.clone());
        let media = media_service
            .create(
                &processed.filename,
                &file_name,
                &processed.mime_type,
                processed.size as i32,
                processed.width as i32,
                processed.height as i32,
                &processed.blur_hash,
                &processed.thumbnail_filename,
                &user.0.id,
            )
            .await
            .map_err(|e| {
                error!(
                    "Database insert failed for media '{}' (uploaded by {}): {:?}",
                    processed.filename, user.0.id, e
                );
                e
            })?;

        info!("Media record created: {}", media.id);

        // Notify admins about new media upload
        let notif_service = NotificationService::with_redis(state.db.clone(), state.redis.clone());
        let uploader_name = user.0.name.as_deref().unwrap_or(&user.0.email);
        let _ = notif_service
            .notify_admins(
                Some(&user.0.id),
                "content",
                "New Media Uploaded",
                Some(&format!(
                    "{} uploaded a new file: {}",
                    uploader_name, media.original_name
                )),
                None,
                None,
                Some("/dashboard/media"),
            )
            .await;

        return Ok(Json(media));
    }

    Err(ApiError::BadRequest("No file uploaded".to_string()))
}

// ---------------------------------------------------------------------------
// Admin media cleanup — on-demand orphan removal
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CleanupQuery {
    /// Grace period in hours — only delete orphans older than this.
    /// Defaults to 24 hours if not specified.
    pub grace_hours: Option<i64>,
    /// If true, only count orphans without deleting (dry-run).
    #[serde(default)]
    pub dry_run: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CleanupResponse {
    pub orphans_found: usize,
    pub orphans_deleted: usize,
    pub files_deleted: usize,
    pub errors: Vec<String>,
    pub dry_run: bool,
}

/// Admin-only endpoint to trigger media orphan cleanup on demand.
///
/// POST /api/media/cleanup?grace_hours=24&dry_run=false
///
/// - `grace_hours` (optional, default 24): only consider media older than
///    this many hours as potential orphans. This gives editors time to
///    finish editing and save references.
/// - `dry_run` (optional, default false): if true, only count orphans
///    without actually deleting anything — useful for auditing.
///
/// Returns a report of how many orphans were found, deleted, and any errors
/// encountered during file deletion.
pub async fn cleanup(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<CleanupQuery>,
) -> Result<Json<CleanupResponse>, ApiError> {
    let grace_hours = query.grace_hours.unwrap_or(24).max(1);
    let dry_run = query.dry_run.unwrap_or(false);

    let cleanup_service = MediaCleanupService::new(state.db.clone(), state.cache.clone());

    if dry_run {
        let count = cleanup_service.count_orphans(grace_hours).await?;

        info!(
            "Media cleanup dry-run: {} orphans found (grace period: {}h)",
            count, grace_hours
        );

        return Ok(Json(CleanupResponse {
            orphans_found: count as usize,
            orphans_deleted: 0,
            files_deleted: 0,
            errors: vec![],
            dry_run: true,
        }));
    }

    // Full cleanup: find orphans, delete DB records, then delete files
    let (orphans, mut report) = cleanup_service.cleanup(grace_hours).await?;

    let mut files_deleted = 0usize;
    let mut errors = Vec::new();

    for orphan in &orphans {
        let thumb = orphan.thumbnail_path.as_deref().unwrap_or("");
        match state
            .image_service
            .delete_image(&orphan.filename, thumb)
            .await
        {
            Ok(_) => {
                files_deleted += 1;
                if !thumb.is_empty() {
                    files_deleted += 1;
                }
            }
            Err(e) => {
                let msg = format!("Failed to delete files for media {}: {}", orphan.id, e);
                warn!("{}", msg);
                errors.push(msg);
            }
        }
    }

    report.files_deleted = files_deleted;
    report.errors.extend(errors);

    info!(
        "Admin media cleanup complete: {} found, {} deleted, {} files removed, {} errors",
        report.orphans_found,
        report.orphans_deleted,
        report.files_deleted,
        report.errors.len()
    );

    Ok(Json(CleanupResponse {
        orphans_found: report.orphans_found,
        orphans_deleted: report.orphans_deleted,
        files_deleted: report.files_deleted,
        errors: report.errors,
        dry_run: false,
    }))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = MediaService::new(state.db.clone(), state.cache.clone());

    // Get existing media
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Media not found".to_string()))?;

    // Only admin or uploader can delete
    if existing.uploaded_by != user.id && user.role != crate::models::user::UserRole::Admin {
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
