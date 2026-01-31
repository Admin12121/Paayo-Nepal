use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError, extractors::auth::AuthenticatedUser, handlers::posts::PaginatedResponse,
    middleware::auth::UserRole, models::comment::Comment, services::CommentService, AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListCommentsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentInput {
    pub content: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentInput {
    pub content: String,
}

pub async fn list_for_post(
    State(state): State<AppState>,
    Path(post_id): Path<String>,
    Query(query): Query<ListCommentsQuery>,
) -> Result<Json<PaginatedResponse<Comment>>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (comments, total) = service.list_for_post(&post_id, page, limit).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: comments,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(post_id): Path<String>,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<Comment>, ApiError> {
    if input.content.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Comment content cannot be empty".to_string(),
        ));
    }

    let service = CommentService::new(state.db.clone(), state.cache.clone());

    let comment = service
        .create(
            &post_id,
            &user.id,
            &input.content,
            input.parent_id.as_deref(),
        )
        .await?;

    Ok(Json(comment))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
    Json(input): Json<UpdateCommentInput>,
) -> Result<Json<Comment>, ApiError> {
    if input.content.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Comment content cannot be empty".to_string(),
        ));
    }

    let service = CommentService::new(state.db.clone(), state.cache.clone());

    // Get existing comment
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment not found".to_string()))?;

    // Only author or admin can update
    if existing.user_id != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let comment = service.update(&id, &input.content).await?;

    Ok(Json(comment))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());

    // Get existing comment
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Comment not found".to_string()))?;

    // Only author or admin can delete
    if existing.user_id != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    service.delete(&id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn like(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = CommentService::new(state.db.clone(), state.cache.clone());

    let liked = service.toggle_like(&id, &user.id).await?;

    Ok(Json(serde_json::json!({ "liked": liked })))
}
