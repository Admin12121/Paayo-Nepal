use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::AdminUser,
    handlers::posts::PaginatedResponse,
    models::tag::{ContentTag, Tag},
    services::TagService,
    AppState,
};

// ─── Query / Input Types ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTagsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub tag_type: Option<String>,
    /// If true, include usage counts (uses the slower join query).
    pub with_counts: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTagInput {
    pub name: String,
    pub tag_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTagInput {
    pub name: Option<String>,
    pub tag_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchTagsQuery {
    pub q: String,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ContentByTagQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub target_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetTagsInput {
    /// List of tag IDs to set on the content item (replaces all existing tags).
    pub tag_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetTagsByNameInput {
    /// List of tag names — tags will be created if they don't exist.
    pub names: Vec<String>,
    /// Tag type to use when creating new tags (defaults to "general").
    pub tag_type: Option<String>,
}

// ─── Tag CRUD Handlers ───────────────────────────────────────────────────────

/// List tags (public). Supports optional usage counts.
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListTagsQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = TagService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(50).min(200).max(1);

    if query.with_counts == Some(true) {
        let (tags, total) = service
            .list_with_counts(query.tag_type.as_deref(), page, limit)
            .await?;

        let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

        Ok(Json(serde_json::json!({
            "data": tags,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
        })))
    } else {
        let (tags, total) = service.list(query.tag_type.as_deref(), page, limit).await?;

        let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

        Ok(Json(serde_json::json!({
            "data": tags,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
        })))
    }
}

/// Get a tag by slug (public).
pub async fn get_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Tag>, ApiError> {
    let service = TagService::new(state.db.clone(), state.cache.clone());

    let tag = service
        .get_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Tag with slug '{}' not found", slug)))?;

    Ok(Json(tag))
}

/// Get a tag by ID (admin convenience).
pub async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Tag>, ApiError> {
    let service = TagService::new(state.db.clone(), state.cache.clone());

    let tag = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Tag not found".to_string()))?;

    Ok(Json(tag))
}

/// Create a new tag (admin only).
pub async fn create(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<CreateTagInput>,
) -> Result<Json<Tag>, ApiError> {
    if input.name.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Tag name cannot be empty".to_string(),
        ));
    }

    let tag_type = input.tag_type.as_deref().unwrap_or("general");
    let valid_types = ["activity", "category", "general"];
    if !valid_types.contains(&tag_type) {
        return Err(ApiError::ValidationError(format!(
            "Invalid tag_type '{}'. Must be one of: activity, category, general",
            tag_type
        )));
    }

    let service = TagService::new(state.db.clone(), state.cache.clone());
    let tag = service.create(input.name.trim(), tag_type).await?;

    Ok(Json(tag))
}

/// Update a tag (admin only).
pub async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateTagInput>,
) -> Result<Json<Tag>, ApiError> {
    // Validate tag_type if provided
    if let Some(ref tt) = input.tag_type {
        let valid_types = ["activity", "category", "general"];
        if !valid_types.contains(&tt.as_str()) {
            return Err(ApiError::ValidationError(format!(
                "Invalid tag_type '{}'. Must be one of: activity, category, general",
                tt
            )));
        }
    }

    let service = TagService::new(state.db.clone(), state.cache.clone());

    let tag = service
        .update(&id, input.name.as_deref(), input.tag_type.as_deref())
        .await?;

    Ok(Json(tag))
}

/// Delete a tag (admin only). Cascades to content_tags associations.
pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = TagService::new(state.db.clone(), state.cache.clone());
    service.delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Search tags by name prefix (public — for autocomplete/typeahead).
pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchTagsQuery>,
) -> Result<Json<Vec<Tag>>, ApiError> {
    if query.q.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Search query cannot be empty".to_string(),
        ));
    }

    let limit = query.limit.unwrap_or(10).min(50).max(1);

    let service = TagService::new(state.db.clone(), state.cache.clone());
    let tags = service.search(query.q.trim(), limit).await?;

    Ok(Json(tags))
}

/// Get content items associated with a tag (public).
/// Returns content_tags records; the frontend resolves them to full content objects.
pub async fn content_by_tag(
    State(state): State<AppState>,
    Path(tag_id): Path<String>,
    Query(query): Query<ContentByTagQuery>,
) -> Result<Json<PaginatedResponse<ContentTag>>, ApiError> {
    let service = TagService::new(state.db.clone(), state.cache.clone());

    // Verify the tag exists
    service
        .get_by_id(&tag_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Tag not found".to_string()))?;

    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);

    // Validate target_type if provided
    if let Some(ref tt) = query.target_type {
        let valid = ["post", "video", "photo", "hotel"];
        if !valid.contains(&tt.as_str()) {
            return Err(ApiError::BadRequest(format!(
                "Invalid target_type '{}'. Must be one of: post, video, photo, hotel",
                tt
            )));
        }
    }

    let (items, total) = service
        .get_content_by_tag(&tag_id, query.target_type.as_deref(), page, limit)
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: items,
        total,
        page,
        limit,
        total_pages,
    }))
}

// ─── Content Tagging Handlers ────────────────────────────────────────────────

/// Get all tags for a specific content item (public).
pub async fn get_content_tags(
    State(state): State<AppState>,
    Path((target_type, target_id)): Path<(String, String)>,
) -> Result<Json<Vec<Tag>>, ApiError> {
    let valid = ["post", "video", "photo", "hotel"];
    if !valid.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo, hotel",
            target_type
        )));
    }

    let service = TagService::new(state.db.clone(), state.cache.clone());
    let tags = service
        .get_tags_for_content(&target_type, &target_id)
        .await?;

    Ok(Json(tags))
}

/// Set tags for a content item by tag IDs (admin — replaces all existing tags).
pub async fn set_content_tags(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path((target_type, target_id)): Path<(String, String)>,
    Json(input): Json<SetTagsInput>,
) -> Result<Json<Vec<Tag>>, ApiError> {
    let valid = ["post", "video", "photo", "hotel"];
    if !valid.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo, hotel",
            target_type
        )));
    }

    let service = TagService::new(state.db.clone(), state.cache.clone());
    let tags = service
        .set_tags_for_content(&target_type, &target_id, &input.tag_ids)
        .await?;

    Ok(Json(tags))
}

/// Set tags for a content item by tag names (admin — creates tags if they don't exist).
/// This is a convenience endpoint for tagging flows where the user types tag names.
pub async fn set_content_tags_by_name(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path((target_type, target_id)): Path<(String, String)>,
    Json(input): Json<SetTagsByNameInput>,
) -> Result<Json<Vec<Tag>>, ApiError> {
    let valid = ["post", "video", "photo", "hotel"];
    if !valid.contains(&target_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid target_type '{}'. Must be one of: post, video, photo, hotel",
            target_type
        )));
    }

    let tag_type = input.tag_type.as_deref().unwrap_or("general");

    let service = TagService::new(state.db.clone(), state.cache.clone());

    // Find or create all tags by name
    let found_tags = service
        .find_or_create_by_names(&input.names, tag_type)
        .await?;

    // Extract IDs and set them on the content
    let tag_ids: Vec<String> = found_tags.iter().map(|t| t.id.clone()).collect();

    let tags = service
        .set_tags_for_content(&target_type, &target_id, &tag_ids)
        .await?;

    Ok(Json(tags))
}

/// Get tag count (admin — for dashboard stats).
pub async fn count(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = TagService::new(state.db.clone(), state.cache.clone());
    let total = service.count().await?;
    Ok(Json(serde_json::json!({ "count": total })))
}
