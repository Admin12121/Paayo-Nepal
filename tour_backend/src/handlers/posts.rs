use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::ApiError,
    extractors::auth::AuthenticatedUser,
    middleware::auth::UserRole,
    models::post::Post,
    services::{NotificationService, PostService},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListPostsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub post_type: Option<String>,
    pub author_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostInput {
    pub title: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub featured_image: Option<String>,
    pub post_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePostInput {
    pub title: Option<String>,
    pub excerpt: Option<String>,
    pub content: Option<String>,
    pub featured_image: Option<String>,
    pub tags: Option<Vec<String>>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub limit: i32,
    pub total_pages: i32,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListPostsQuery>,
) -> Result<Json<PaginatedResponse<Post>>, ApiError> {
    let service = PostService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(10);

    let (posts, total) = service
        .list(
            page,
            limit,
            query.status.as_deref(),
            query.post_type.as_deref(),
            query.author_id.as_deref(),
        )
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: posts,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn get_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Post>, ApiError> {
    let service = PostService::new(state.db.clone(), state.cache.clone());

    let post = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Post with slug '{}' not found", slug)))?;

    // Increment view count asynchronously
    let db = state.db.clone();
    let post_id = post.id.clone();
    tokio::spawn(async move {
        let _ = sqlx::query("UPDATE posts SET views = views + 1 WHERE id = ?")
            .bind(&post_id)
            .execute(&db)
            .await;
    });

    Ok(Json(post))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(input): Json<CreatePostInput>,
) -> Result<Json<Post>, ApiError> {
    // Only active editors and admins can create posts
    if user.role == UserRole::User {
        return Err(ApiError::Forbidden);
    }
    if user.role != UserRole::Admin && !user.is_active {
        return Err(ApiError::Forbidden);
    }

    let service = PostService::new(state.db.clone(), state.cache.clone());

    let post = service
        .create(
            &input.title,
            input.excerpt.as_deref(),
            &input.content,
            input.featured_image.as_deref(),
            input.post_type.as_deref().unwrap_or("blog"),
            &user.id,
            input.tags.as_deref(),
            input.meta_title.as_deref(),
            input.meta_description.as_deref(),
        )
        .await?;

    // Notify admins about new post
    let notif_service = NotificationService::with_redis(state.db.clone(), state.redis.clone());
    let author_name = user.name.as_deref().unwrap_or(&user.email);
    let _ = notif_service
        .notify_admins(
            "new_post_review",
            "New Post Submitted",
            Some(&format!(
                "{} submitted a new post: {}",
                author_name, input.title
            )),
            Some(&format!("/dashboard/posts/{}/edit", post.slug)),
        )
        .await;

    Ok(Json(post))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
    Json(input): Json<UpdatePostInput>,
) -> Result<Json<Post>, ApiError> {
    let service = PostService::new(state.db.clone(), state.cache.clone());

    // Get existing post
    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Post with slug '{}' not found", slug)))?;

    // Check permission: author can edit their own, admin can edit any
    if existing.author_id != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let post = service
        .update(
            &existing.id,
            input.title.as_deref(),
            input.excerpt.as_deref(),
            input.content.as_deref(),
            input.featured_image.as_deref(),
            input.tags.as_deref(),
            input.meta_title.as_deref(),
            input.meta_description.as_deref(),
        )
        .await?;

    Ok(Json(post))
}

pub async fn delete(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = PostService::new(state.db.clone(), state.cache.clone());

    // Get existing post
    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Post with slug '{}' not found", slug)))?;

    // Only admin or author can delete
    if existing.author_id != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn publish(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
) -> Result<Json<Post>, ApiError> {
    let service = PostService::new(state.db.clone(), state.cache.clone());

    // Get existing post
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))?;

    // Author submits for review, changes status to pending
    if existing.author_id != user.id && user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let new_status = if user.role == UserRole::Admin {
        "published"
    } else {
        "pending"
    };

    let post = service.update_status(&id, new_status).await?;

    Ok(Json(post))
}

pub async fn approve(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
) -> Result<Json<Post>, ApiError> {
    // Only admin can approve posts
    if user.role != UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let service = PostService::new(state.db.clone(), state.cache.clone());

    let post = service.approve(&id, &user.id).await?;

    Ok(Json(post))
}
