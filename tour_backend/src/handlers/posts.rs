use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::ApiError,
    extractors::auth::{ActiveEditorUser, AdminUser, AuthenticatedUser, EditorUser, OptionalUser},
    models::common::ContentStatus,
    models::post::Post,
    models::user::UserRole,
    utils::validation::sanitize_content_value,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListPostsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub post_type: Option<String>,
    pub author_id: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    pub sort_by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostInput {
    pub title: String,
    pub post_type: Option<String>,
    pub short_description: Option<String>,
    pub content: Option<serde_json::Value>,
    pub cover_image: Option<String>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    pub event_date: Option<String>,
    pub event_end_date: Option<String>,
}

/// Update input where nullable fields use `Option<Option<T>>`:
///
/// - Outer `None`        → field was absent from JSON, keep the existing value
/// - `Some(None)`        → field was explicitly set to `null`, clear it (set DB column to NULL)
/// - `Some(Some(value))` → field was set to a new value
///
/// Non-nullable fields (`title`, `is_featured`) remain plain `Option<T>`:
/// - `None` → keep existing
/// - `Some(value)` → update
#[derive(Debug, Deserialize)]
pub struct UpdatePostInput {
    pub title: Option<String>,
    pub post_type: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub short_description: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable_value")]
    pub content: Option<Option<serde_json::Value>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub cover_image: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub region_id: Option<Option<String>>,
    pub is_featured: Option<bool>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub event_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub event_end_date: Option<Option<String>>,
}

/// Custom deserializer for `Option<Option<String>>`:
/// - absent field → `None`
/// - `null`       → `Some(None)`
/// - `"value"`    → `Some(Some("value"))`
fn deserialize_optional_nullable<'de, D>(
    deserializer: D,
) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    // When serde reaches this function the field is present in the JSON.
    // If the JSON value is null, Option::deserialize yields None.
    // If the JSON value is a string, it yields Some(string).
    // In both cases we wrap in Some() so the outer Option distinguishes
    // "present" (Some) from "absent" (the #[serde(default)] case).
    Ok(Some(opt))
}

/// Custom deserializer for `Option<Option<serde_json::Value>>`:
/// - absent field → `None`
/// - `null`       → `Some(None)`
/// - `{...}`      → `Some(Some(value))`
fn deserialize_optional_nullable_value<'de, D>(
    deserializer: D,
) -> Result<Option<Option<serde_json::Value>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(Some(opt))
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub limit: i32,
    pub total_pages: i32,
}

/// List posts.
///
/// **Public users** (unauthenticated or non-editor/admin) only see published posts.
/// The `status` query parameter is ignored for public users — this prevents
/// accidental or intentional exposure of draft content (fix 5.11).
///
/// **Editors / Admins** can filter by any status via the query parameter.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListPostsQuery>,
) -> Result<Json<PaginatedResponse<Post>>, ApiError> {
    let service = state.post_service();

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(10).min(100).max(1);

    // Determine effective status filter based on the caller's role.
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == crate::models::user::UserRole::Admin
            || u.role == crate::models::user::UserRole::Editor
    });

    let effective_status: Option<String> = if is_privileged {
        // Editors/admins can use whatever status filter they want
        query.status.clone()
    } else {
        // Public users always see only published posts
        Some("published".to_string())
    };

    let (posts, total) = service
        .list(
            page,
            limit,
            effective_status.as_deref(),
            query.post_type.as_deref(),
            query.author_id.as_deref(),
            query.region_id.as_deref(),
            query.is_featured,
            query.sort_by.as_deref(),
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

/// Get a post by slug.
///
/// **Public users** only see published posts. If a draft/unpublished post
/// matches the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view posts in any status (needed for the edit
/// dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<Post>, ApiError> {
    let service = state.post_service();

    let post = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Post with slug '{}' not found", slug)))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && post.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Post with slug '{}' not found",
            slug
        )));
    }

    // View counting is handled exclusively by the frontend ViewTracker component,
    // which calls POST /views → ViewService::record_view() with 24h dedup.
    // Do NOT increment view_count here — that would double-count every page load.

    Ok(Json(post))
}

/// Create a new post (requires active editor or admin)
pub async fn create(
    State(state): State<AppState>,
    user: ActiveEditorUser,
    Json(input): Json<CreatePostInput>,
) -> Result<Json<Post>, ApiError> {
    if input.title.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Title cannot be empty".to_string(),
        ));
    }

    let service = state.post_service();

    // Sanitize rich HTML content before storage (defence-in-depth — even if
    // frontend DOMPurify is bypassed via direct API call, stored HTML is safe).
    let sanitized_content = sanitize_content_value(input.content.as_ref());

    let post = service
        .create(
            input.post_type.as_deref().unwrap_or("article"),
            &user.0.id,
            &input.title,
            input.short_description.as_deref(),
            sanitized_content.as_ref(),
            input.cover_image.as_deref(),
            input.region_id.as_deref(),
            input.is_featured.unwrap_or(false),
            input.event_date.as_deref(),
            input.event_end_date.as_deref(),
        )
        .await?;

    // Notify admins about new post
    let notif_service = state.notification_service();
    let author_name = user.0.name.as_deref().unwrap_or(&user.0.email);
    let _ = notif_service
        .notify_admins(
            Some(&user.0.id),
            "content",
            "New Post Created",
            Some(&format!(
                "{} created a new post: {}",
                author_name, input.title
            )),
            Some("post"),
            Some(&post.id),
            Some(&format!("/dashboard/posts/{}/edit", post.slug)),
        )
        .await;

    Ok(Json(post))
}

/// Update an existing post (author or admin).
///
/// Nullable fields (`short_description`, `content`, `cover_image`, `region_id`,
/// `event_date`, `event_end_date`) can be **cleared** by sending the field with
/// a JSON `null` value. Omitting the field keeps the existing value (fix 5.9).
pub async fn update(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(slug): Path<String>,
    Json(input): Json<UpdatePostInput>,
) -> Result<Json<Post>, ApiError> {
    let service = state.post_service();

    // Get existing post
    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Post with slug '{}' not found", slug)))?;

    // Check permission: author can edit their own, admin can edit any
    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    // Sanitize rich HTML content before storage (defence-in-depth).
    // The `Option<Option<Value>>` structure is preserved:
    //   - None           → field absent, keep existing (not sanitized)
    //   - Some(None)     → field set to null, clear it
    //   - Some(Some(v))  → field set to new value, sanitize it
    let sanitized_content = input
        .content
        .map(|opt_val| opt_val.and_then(|v| sanitize_content_value(Some(&v))));

    let post = service
        .update(
            &existing.id,
            input.title.as_deref(),
            input.post_type.as_deref(),
            input.short_description,
            sanitized_content,
            input.cover_image,
            input.region_id,
            input.is_featured,
            input.event_date,
            input.event_end_date,
        )
        .await?;

    Ok(Json(post))
}

/// Delete a post — soft delete (author or admin)
pub async fn delete(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.post_service();

    // Get existing post
    let existing = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Post with slug '{}' not found", slug)))?;

    // Only admin or author can delete
    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    service.delete(&existing.id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Publish a post (admin publishes directly, editor changes to published)
pub async fn publish(
    State(state): State<AppState>,
    user: EditorUser,
    Path(id): Path<String>,
) -> Result<Json<Post>, ApiError> {
    let service = state.post_service();

    // Get existing post
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))?;

    // Author submits, admin can approve directly
    if existing.author_id != user.0.id && user.0.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let post = service.update_status(&id, "published").await?;

    Ok(Json(post))
}

/// Admin-only: update status (e.g., unpublish back to draft)
pub async fn update_status(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<Post>, ApiError> {
    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("Missing 'status' field".to_string()))?;

    if status != "draft" && status != "published" {
        return Err(ApiError::BadRequest(
            "Status must be 'draft' or 'published'".to_string(),
        ));
    }

    let service = state.post_service();
    let post = service.update_status(&id, status).await?;

    Ok(Json(post))
}
