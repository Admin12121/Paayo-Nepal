use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::AuthenticatedUser,
    models::content_link::{
        ContentLink, ContentLinkSource, ContentLinkTarget, CreateContentLinkInput,
        SetContentLinkItem, SetContentLinksInput, UpdateContentLinkInput,
    },
    models::user::UserRole,
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
    let normalized_source_type = source_type.trim().to_lowercase();
    let normalized_source_id = source_id.trim();

    if normalized_source_id.is_empty() {
        return Err(ApiError::ValidationError(
            "source_id cannot be empty".to_string(),
        ));
    }

    let links = service
        .list_for_source(&normalized_source_type, normalized_source_id)
        .await?;
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
    let normalized_target_type = target_type.trim().to_lowercase();
    let normalized_target_id = target_id.trim();

    if normalized_target_id.is_empty() {
        return Err(ApiError::ValidationError(
            "target_id cannot be empty".to_string(),
        ));
    }

    let links = service
        .list_for_target(&normalized_target_type, normalized_target_id)
        .await?;
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
/// **Authorized owner/admin only.**
///
/// `POST /api/content-links`
pub async fn create(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(input): Json<CreateContentLinkInput>,
) -> Result<Json<ContentLink>, ApiError> {
    validate_create_input(&input)?;

    let normalized_source_type = input.source_type.trim().to_lowercase();
    let normalized_source_id = input.source_id.trim();
    let normalized_target_type = input.target_type.trim().to_lowercase();
    let normalized_target_id = input.target_id.trim();

    ensure_source_write_permission(
        &state,
        &user,
        &normalized_source_type,
        normalized_source_id,
    )
    .await?;

    let service = state.content_link_service();
    let link = service
        .create(
            &normalized_source_type,
            normalized_source_id,
            &normalized_target_type,
            normalized_target_id,
            input.display_order,
        )
        .await?;

    Ok(Json(link))
}

/// Update the display order of a content link.
///
/// **Authorized owner/admin only.**
///
/// `PUT /api/content-links/by-id/:id`
pub async fn update(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateContentLinkInput>,
) -> Result<Json<ContentLink>, ApiError> {
    let order = input.display_order.unwrap_or(0);
    let service = state.content_link_service();
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content link '{}' not found", id)))?;
    ensure_source_write_permission(
        &state,
        &user,
        existing.source_type.as_str(),
        &existing.source_id,
    )
    .await?;
    let link = service.update_order(&id, order).await?;
    Ok(Json(link))
}

/// Delete a single content link by ID.
///
/// **Authorized owner/admin only.**
///
/// `DELETE /api/content-links/by-id/:id`
pub async fn delete(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.content_link_service();
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content link '{}' not found", id)))?;
    ensure_source_write_permission(
        &state,
        &user,
        existing.source_type.as_str(),
        &existing.source_id,
    )
    .await?;
    service.delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Replace all content links for a given source item (transactional batch set).
///
/// Deletes all existing links for `(source_type, source_id)` and inserts the
/// provided list. Sending an empty `links` array removes all links.
///
/// **Authorized owner/admin only.**
///
/// `PUT /api/content-links/:source_type/:source_id`
pub async fn set_links(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path((source_type, source_id)): Path<(String, String)>,
    Json(input): Json<SetContentLinksInput>,
) -> Result<Json<Vec<ContentLink>>, ApiError> {
    // Cap the number of links per source to a reasonable maximum
    if input.links.len() > 50 {
        return Err(ApiError::ValidationError(
            "Cannot set more than 50 content links per source item".to_string(),
        ));
    }

    let normalized_source_type = source_type.trim().to_lowercase();
    let normalized_source_id = source_id.trim().to_string();
    let normalized_links = input
        .links
        .into_iter()
        .map(|item| SetContentLinkItem {
            target_type: item.target_type.trim().to_lowercase(),
            target_id: item.target_id.trim().to_string(),
            display_order: item.display_order,
        })
        .collect::<Vec<_>>();

    ensure_source_write_permission(
        &state,
        &user,
        &normalized_source_type,
        &normalized_source_id,
    )
    .await?;

    let service = state.content_link_service();
    let links = service
        .set_links(&normalized_source_type, &normalized_source_id, &normalized_links)
        .await?;
    Ok(Json(links))
}

/// Delete all content links for a given source item.
///
/// **Authorized owner/admin only.**
///
/// `DELETE /api/content-links/:source_type/:source_id`
pub async fn delete_all_for_source(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path((source_type, source_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let normalized_source_type = source_type.trim().to_lowercase();
    let normalized_source_id = source_id.trim();
    if normalized_source_id.is_empty() {
        return Err(ApiError::ValidationError(
            "source_id cannot be empty".to_string(),
        ));
    }

    ensure_source_write_permission(
        &state,
        &user,
        &normalized_source_type,
        normalized_source_id,
    )
    .await?;

    let service = state.content_link_service();
    let count = service
        .delete_all_for_source(&normalized_source_type, normalized_source_id)
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
    let normalized_source_type = source_type.trim().to_lowercase();
    let normalized_source_id = source_id.trim();
    if normalized_source_id.is_empty() {
        return Err(ApiError::ValidationError(
            "source_id cannot be empty".to_string(),
        ));
    }

    let service = state.content_link_service();
    let count = service
        .count_for_source(&normalized_source_type, normalized_source_id)
        .await?;
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
    if ContentLinkSource::from_str(input.source_type.trim()).is_none() {
        return Err(ApiError::ValidationError(format!(
            "Invalid source_type '{}'. Must be one of: {}",
            input.source_type,
            ContentLinkSource::VALID.join(", ")
        )));
    }
    if ContentLinkTarget::from_str(input.target_type.trim()).is_none() {
        return Err(ApiError::ValidationError(format!(
            "Invalid target_type '{}'. Must be one of: {}",
            input.target_type,
            ContentLinkTarget::VALID.join(", ")
        )));
    }
    Ok(())
}

async fn ensure_source_write_permission(
    state: &AppState,
    user: &AuthenticatedUser,
    source_type: &str,
    source_id: &str,
) -> Result<(), ApiError> {
    let normalized_source_type = source_type.trim();
    let normalized_source_id = source_id.trim();

    if user.role == UserRole::Admin {
        return Ok(());
    }

    match normalized_source_type {
        "post" => {
            let post_author = sqlx::query_as::<_, (String,)>(
                "SELECT author_id FROM posts WHERE id = $1 AND deleted_at IS NULL",
            )
            .bind(normalized_source_id)
            .fetch_optional(&state.db)
            .await?;

            let Some((author_id,)) = post_author else {
                return Err(ApiError::NotFound(format!(
                    "Source 'post' with id '{}' does not exist",
                    normalized_source_id
                )));
            };

            if author_id != user.id {
                return Err(ApiError::Forbidden);
            }

            Ok(())
        }
        "region" => {
            let region_author = sqlx::query_as::<_, (String,)>(
                "SELECT author_id FROM regions WHERE id = $1 AND deleted_at IS NULL",
            )
            .bind(normalized_source_id)
            .fetch_optional(&state.db)
            .await?;

            let Some((author_id,)) = region_author else {
                return Err(ApiError::NotFound(format!(
                    "Source 'region' with id '{}' does not exist",
                    normalized_source_id
                )));
            };

            if user.role != UserRole::Editor || author_id != user.id {
                return Err(ApiError::Forbidden);
            }

            Ok(())
        }
        _ => Err(ApiError::ValidationError(format!(
            "Invalid source_type '{}'. Must be one of: {}",
            source_type,
            ContentLinkSource::VALID.join(", ")
        ))),
    }
}
