use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::AdminUser,
    models::content_link::{
        ContentLink, ContentLinkSource, ContentLinkTarget, CreateContentLinkInput,
        SetContentLinksInput, UpdateContentLinkInput,
    },
    AppState,
};

/// List all content links for a given source item.
///
/// **Public** — no auth required.
///
/// `GET /api/content-links/:source_type/:source_id`
pub async fn list_for_source(
    State(state): State<AppState>,
    Path((source_type, source_id)): Path<(String, String)>,
) -> Result<Json<Vec<ContentLink>>, ApiError> {
    let service = state.content_link_service();
    let links = service.list_for_source(&source_type, &source_id).await?;
    Ok(Json(links))
}

/// List all content links that point to a given target item.
///
/// **Public** — no auth required.
///
/// `GET /api/content-links/target/:target_type/:target_id`
pub async fn list_for_target(
    State(state): State<AppState>,
    Path((target_type, target_id)): Path<(String, String)>,
) -> Result<Json<Vec<ContentLink>>, ApiError> {
    let service = state.content_link_service();
    let links = service.list_for_target(&target_type, &target_id).await?;
    Ok(Json(links))
}

/// Get a single content link by ID.
///
/// **Public** — no auth required.
///
/// `GET /api/content-links/by-id/:id`
pub async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ContentLink>, ApiError> {
    let service = state.content_link_service();
    let link = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content link '{}' not found", id)))?;
    Ok(Json(link))
}

/// Create a single content link.
///
/// **Admin only.**
///
/// `POST /api/content-links`
pub async fn create(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<CreateContentLinkInput>,
) -> Result<Json<ContentLink>, ApiError> {
    validate_create_input(&input)?;

    let service = state.content_link_service();
    let link = service
        .create(
            &input.source_type,
            &input.source_id,
            &input.target_type,
            &input.target_id,
            input.display_order,
        )
        .await?;

    Ok(Json(link))
}

/// Update the display order of a content link.
///
/// **Admin only.**
///
/// `PUT /api/content-links/by-id/:id`
pub async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateContentLinkInput>,
) -> Result<Json<ContentLink>, ApiError> {
    let order = input.display_order.unwrap_or(0);
    let service = state.content_link_service();
    let link = service.update_order(&id, order).await?;
    Ok(Json(link))
}

/// Delete a single content link by ID.
///
/// **Admin only.**
///
/// `DELETE /api/content-links/by-id/:id`
pub async fn delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.content_link_service();
    service.delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Replace all content links for a given source item (transactional batch set).
///
/// Deletes all existing links for `(source_type, source_id)` and inserts the
/// provided list. Sending an empty `links` array removes all links.
///
/// **Admin only.**
///
/// `PUT /api/content-links/:source_type/:source_id`
pub async fn set_links(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path((source_type, source_id)): Path<(String, String)>,
    Json(input): Json<SetContentLinksInput>,
) -> Result<Json<Vec<ContentLink>>, ApiError> {
    // Cap the number of links per source to a reasonable maximum
    if input.links.len() > 50 {
        return Err(ApiError::ValidationError(
            "Cannot set more than 50 content links per source item".to_string(),
        ));
    }

    let service = state.content_link_service();
    let links = service
        .set_links(&source_type, &source_id, &input.links)
        .await?;
    Ok(Json(links))
}

/// Delete all content links for a given source item.
///
/// **Admin only.**
///
/// `DELETE /api/content-links/:source_type/:source_id`
pub async fn delete_all_for_source(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path((source_type, source_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.content_link_service();
    let count = service
        .delete_all_for_source(&source_type, &source_id)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": count })))
}

/// Count content links for a given source item.
///
/// **Public** — no auth required.
///
/// `GET /api/content-links/:source_type/:source_id/count`
pub async fn count_for_source(
    State(state): State<AppState>,
    Path((source_type, source_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.content_link_service();
    let count = service.count_for_source(&source_type, &source_id).await?;
    Ok(Json(serde_json::json!({ "count": count })))
}

// ── Validation helpers ───────────────────────────────────────────────────

/// Query params for listing links (currently unused but reserved for future
/// filtering/pagination if needed).
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ListLinksQuery {
    pub target_type: Option<String>,
}

fn validate_create_input(input: &CreateContentLinkInput) -> Result<(), ApiError> {
    if input.source_id.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "source_id cannot be empty".to_string(),
        ));
    }
    if input.target_id.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "target_id cannot be empty".to_string(),
        ));
    }
    if ContentLinkSource::from_str(&input.source_type).is_none() {
        return Err(ApiError::ValidationError(format!(
            "Invalid source_type '{}'. Must be one of: {}",
            input.source_type,
            ContentLinkSource::VALID.join(", ")
        )));
    }
    if ContentLinkTarget::from_str(&input.target_type).is_none() {
        return Err(ApiError::ValidationError(format!(
            "Invalid target_type '{}'. Must be one of: {}",
            input.target_type,
            ContentLinkTarget::VALID.join(", ")
        )));
    }
    Ok(())
}
