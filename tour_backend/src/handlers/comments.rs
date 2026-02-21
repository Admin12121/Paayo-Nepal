use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use validator::ValidateEmail;

use crate::{
    error::ApiError, extractors::auth::AdminUser, handlers::posts::PaginatedResponse,
    models::comment::Comment, services::CommentService, AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListCommentsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListModerationQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentInput {
    pub guest_name: String,
    pub guest_email: String,
    pub content: String,
    pub target_type: String,
    pub target_id: String,
    pub parent_id: Option<String>,
}

/// List approved comments for a specific content item (public).
/// Used on the frontend to show comments under posts/videos/photos.
pub async fn list_for_content(
    State(state): State<AppState>,
    Query(query): Query<ListCommentsQuery>,
) -> Result<Json<PaginatedResponse<Comment>>, ApiError> {
    let target_type = query
        .target_type
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("target_type is required".to_string()))?;
    let target_id = query
        .target_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("target_id is required".to_string()))?;

    let normalized_target_type = target_type.trim().to_lowercase();
    let normalized_target_id = target_id.trim();
    let valid_types = ["post", "video", "photo", "hotel"];
    if !valid_types.contains(&normalized_target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo, hotel",
            target_type
        )));
    }
    if normalized_target_id.is_empty() {
        return Err(ApiError::BadRequest("target_id is required".to_string()));
    }

    let service = CommentService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    let (comments, total) = service
        .list_approved(&normalized_target_type, normalized_target_id, page, limit)
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: comments,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// List approved comments for a specific post by post_id (public, convenience route).
pub async fn list_for_post(
    State(state): State<AppState>,
    Path(post_id): Path<String>,
    Query(query): Query<ListCommentsQuery>,
) -> Result<Json<PaginatedResponse<Comment>>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    let (comments, total) = service.list_approved("post", &post_id, page, limit).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: comments,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get replies for a specific comment (public).
pub async fn replies(
    State(state): State<AppState>,
    Path(comment_id): Path<String>,
) -> Result<Json<Vec<Comment>>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let replies = service.list_replies(&comment_id).await?;
    Ok(Json(replies))
}

/// Create a new guest comment (public - no auth required).
/// Comments are published immediately (no moderation gate).
/// Rate-limited by viewer_hash.
pub async fn create(
    State(state): State<AppState>,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<std::net::SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<Comment>, ApiError> {
    // Validate input
    if input.content.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Comment content cannot be empty".to_string(),
        ));
    }
    if input.guest_name.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Guest name cannot be empty".to_string(),
        ));
    }
    if !input.guest_email.validate_email() {
        return Err(ApiError::ValidationError(
            "Invalid email address".to_string(),
        ));
    }
    let normalized_target_type = input.target_type.trim().to_lowercase();
    let valid_types = ["post", "video", "photo", "hotel"];
    if !valid_types.contains(&normalized_target_type.as_str()) {
        return Err(ApiError::ValidationError(
            "target_type must be one of: post, video, photo, hotel".to_string(),
        ));
    }
    let normalized_target_id = input.target_id.trim();
    if normalized_target_id.is_empty() {
        return Err(ApiError::ValidationError(
            "target_id cannot be empty".to_string(),
        ));
    }
    if input.content.len() > 5000 {
        return Err(ApiError::ValidationError(
            "Comment must be less than 5000 characters".to_string(),
        ));
    }

    // ── HTML sanitization (XSS prevention) ──────────────────────────────
    // Allow only safe inline formatting tags. Everything else (script, img,
    // iframe, style, event handlers, etc.) is stripped.
    let sanitized_content = {
        use std::collections::HashSet;
        use std::iter::FromIterator;

        let allowed_tags: HashSet<&str> = HashSet::from_iter([
            "b",
            "i",
            "em",
            "strong",
            "a",
            "br",
            "p",
            "ul",
            "ol",
            "li",
            "blockquote",
            "code",
        ]);
        let allowed_schemes: HashSet<&str> = HashSet::from_iter(["http", "https"]);

        ammonia::Builder::new()
            .tags(allowed_tags)
            .link_rel(Some("noopener noreferrer nofollow"))
            .url_schemes(allowed_schemes)
            .clean(&input.content)
            .to_string()
    };

    if sanitized_content.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Comment content cannot be empty after sanitization".to_string(),
        ));
    }

    // Sanitize guest name — strip ALL HTML (plain text only)
    let sanitized_name = ammonia::clean(&input.guest_name);

    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    // Generate viewer hash for rate limiting and dedup
    let viewer_hash = crate::services::generate_viewer_hash(&ip, user_agent, "comment");

    let service = CommentService::new(state.db.clone(), state.cache.clone());

    // Rate limit: max 5 comments per hour from the same viewer
    if service.is_rate_limited(&viewer_hash, 5).await? {
        return Err(ApiError::TooManyRequests);
    }

    let comment = service
        .create(
            &normalized_target_type,
            normalized_target_id,
            sanitized_name.trim(),
            input.guest_email.trim(),
            sanitized_content.trim(),
            input.parent_id.as_deref(),
            Some(&ip),
            Some(&viewer_hash),
        )
        .await?;

    // Notify admins about new comment
    let notif_service =
        crate::services::NotificationService::with_redis(state.db.clone(), state.redis.clone());
    let _ = notif_service
        .notify_admins(
            None,
            "comment",
            "New Comment",
            Some(&format!(
                "{} commented on {} {}",
                input.guest_name.trim(),
                normalized_target_type,
                normalized_target_id
            )),
            Some(&normalized_target_type),
            Some(normalized_target_id),
            Some("/dashboard/comments"),
        )
        .await;

    Ok(Json(comment))
}

/// Admin: list all comments for moderation (all statuses).
pub async fn list_for_moderation(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<ListModerationQuery>,
) -> Result<Json<PaginatedResponse<Comment>>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    let (comments, total) = service
        .list_for_moderation(query.status.as_deref(), page, limit)
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: comments,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Admin: get pending comment count (for dashboard badge).
pub async fn pending_count(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let count = service.count_pending().await?;
    Ok(Json(serde_json::json!({ "count": count })))
}

/// Admin: approve a comment.
pub async fn approve(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Comment>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let comment = service.approve(&id).await?;
    Ok(Json(comment))
}

/// Admin: reject a comment.
pub async fn reject(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Comment>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let comment = service.reject(&id).await?;
    Ok(Json(comment))
}

/// Admin: mark a comment as spam.
pub async fn mark_spam(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Comment>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let comment = service.mark_spam(&id).await?;
    Ok(Json(comment))
}

/// Admin: delete a comment and its replies.
pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    service.delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Admin: batch approve multiple comments.
#[derive(Debug, Deserialize)]
pub struct BatchIdsInput {
    pub ids: Vec<String>,
}

pub async fn batch_approve(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<BatchIdsInput>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let count = service.batch_approve(&input.ids).await?;
    Ok(Json(serde_json::json!({ "approved": count })))
}

/// Admin: batch delete multiple comments.
pub async fn batch_delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<BatchIdsInput>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());
    let count = service.batch_delete(&input.ids).await?;
    Ok(Json(serde_json::json!({ "deleted": count })))
}
