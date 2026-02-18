use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::{ActiveEditorUser, AdminUser, AuthenticatedUser, OptionalUser},
    handlers::posts::PaginatedResponse,
    models::common::ContentStatus,
    models::hotel::{Hotel, HotelBranch, HotelWithBranches},
    models::user::UserRole,
    services::HotelService,
    utils::validation::sanitize_rich_html,
    AppState,
};

// ─── Query / Input Types ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListHotelsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub status: Option<String>,
    pub region_id: Option<String>,
    pub price_range: Option<String>,
    pub is_featured: Option<bool>,
    pub sort_by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHotelInput {
    pub name: String,
    pub description: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub star_rating: Option<i16>,
    pub price_range: Option<String>,
    pub amenities: Option<serde_json::Value>,
    pub cover_image: Option<String>,
    pub gallery: Option<serde_json::Value>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHotelInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub star_rating: Option<i16>,
    pub price_range: Option<String>,
    pub amenities: Option<serde_json::Value>,
    pub cover_image: Option<String>,
    pub gallery: Option<serde_json::Value>,
    pub region_id: Option<String>,
    pub is_featured: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBranchInput {
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub coordinates: Option<serde_json::Value>,
    pub is_main: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBranchInput {
    pub name: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub coordinates: Option<serde_json::Value>,
    pub is_main: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct TrashQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

// ─── Hotel CRUD Handlers ─────────────────────────────────────────────────────

/// List hotels (public — defaults to published only unless editor/admin provides status filter).
///
/// **Public users** (unauthenticated or non-editor/admin) only see published hotels.
/// The `status` query parameter is ignored for public users — this prevents
/// accidental or intentional exposure of draft content.
///
/// **Editors / Admins** can filter by any status via the query parameter.
pub async fn list(
    State(state): State<AppState>,
    user: OptionalUser,
    Query(query): Query<ListHotelsQuery>,
) -> Result<Json<PaginatedResponse<Hotel>>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

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

    let (hotels, total) = service
        .list(
            page,
            limit,
            effective_status.as_deref(),
            query.region_id.as_deref(),
            query.price_range.as_deref(),
            query.is_featured,
            query.sort_by.as_deref(),
        )
        .await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: hotels,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get a hotel by slug with its branches.
///
/// **Public users** only see published hotels. If a draft hotel matches
/// the slug, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view hotels in any status (needed for the edit
/// dashboard to load drafts).
pub async fn get_by_slug(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(slug): Path<String>,
) -> Result<Json<HotelWithBranches>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

    let result = service
        .get_with_branches_by_slug(&slug)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Hotel with slug '{}' not found", slug)))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && result.status != ContentStatus::Published {
        return Err(ApiError::NotFound(format!(
            "Hotel with slug '{}' not found",
            slug
        )));
    }

    Ok(Json(result))
}

/// Get a hotel by ID with its branches.
///
/// **Public users** only see published hotels. If a draft hotel matches
/// the ID, a 404 is returned — preventing information leaks.
///
/// **Editors / Admins** can view hotels in any status.
pub async fn get_by_id(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(id): Path<String>,
) -> Result<Json<HotelWithBranches>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

    let result = service
        .get_with_branches(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    // Enforce published-only for non-privileged users (fix: draft content leak)
    let is_privileged = user.0.as_ref().map_or(false, |u| {
        u.role == UserRole::Admin || u.role == UserRole::Editor
    });

    if !is_privileged && result.status != ContentStatus::Published {
        return Err(ApiError::NotFound("Hotel not found".to_string()));
    }

    Ok(Json(result))
}

/// Create a new hotel (requires active editor or admin).
pub async fn create(
    State(state): State<AppState>,
    user: ActiveEditorUser,
    Json(input): Json<CreateHotelInput>,
) -> Result<Json<Hotel>, ApiError> {
    if input.name.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Hotel name cannot be empty".to_string(),
        ));
    }

    // Validate price_range if provided
    if let Some(ref pr) = input.price_range {
        let valid = ["budget", "mid", "luxury"];
        if !valid.contains(&pr.as_str()) {
            return Err(ApiError::ValidationError(format!(
                "Invalid price_range '{}'. Must be one of: budget, mid, luxury",
                pr
            )));
        }
    }

    // Validate star_rating if provided
    if let Some(sr) = input.star_rating {
        if !(1..=5).contains(&sr) {
            return Err(ApiError::ValidationError(
                "star_rating must be between 1 and 5".to_string(),
            ));
        }
    }

    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let normalized_region_id = input
        .region_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    // Sanitize rich HTML description before storage (defence-in-depth)
    let sanitized_description = input.description.as_deref().map(sanitize_rich_html);

    let hotel = service
        .create(
            &user.0.id,
            input.name.trim(),
            sanitized_description.as_deref(),
            input.email.as_deref(),
            input.phone.as_deref(),
            input.website.as_deref(),
            input.star_rating,
            input.price_range.as_deref(),
            input.amenities.as_ref(),
            input.cover_image.as_deref(),
            input.gallery.as_ref(),
            normalized_region_id,
            input.is_featured.unwrap_or(false),
        )
        .await?;

    Ok(Json(hotel))
}

/// Update an existing hotel (author or admin).
pub async fn update(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
    Json(input): Json<UpdateHotelInput>,
) -> Result<Json<Hotel>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

    // Check that the hotel exists and verify permission
    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    // Validate price_range if provided
    if let Some(ref pr) = input.price_range {
        let valid = ["budget", "mid", "luxury"];
        if !valid.contains(&pr.as_str()) {
            return Err(ApiError::ValidationError(format!(
                "Invalid price_range '{}'. Must be one of: budget, mid, luxury",
                pr
            )));
        }
    }

    if let Some(sr) = input.star_rating {
        if !(1..=5).contains(&sr) {
            return Err(ApiError::ValidationError(
                "star_rating must be between 1 and 5".to_string(),
            ));
        }
    }

    let normalized_region_id = input
        .region_id
        .as_deref()
        .map(str::trim);

    // Sanitize rich HTML description before storage (defence-in-depth)
    let sanitized_description = input.description.as_deref().map(sanitize_rich_html);

    let hotel = service
        .update(
            &id,
            input.name.as_deref(),
            sanitized_description.as_deref(),
            input.email.as_deref(),
            input.phone.as_deref(),
            input.website.as_deref(),
            input.star_rating,
            input.price_range.as_deref(),
            input.amenities.as_ref(),
            input.cover_image.as_deref(),
            input.gallery.as_ref(),
            normalized_region_id,
            input.is_featured,
            input.status.as_deref(),
        )
        .await?;

    Ok(Json(hotel))
}

/// Update hotel status (admin only).
pub async fn update_status(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<Hotel>, ApiError> {
    let status = body
        .get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::BadRequest("Missing 'status' field".to_string()))?;

    if status != "draft" && status != "published" {
        return Err(ApiError::BadRequest(
            "Status must be 'draft' or 'published'".to_string(),
        ));
    }

    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let hotel = service.update_status(&id, status).await?;

    Ok(Json(hotel))
}

/// Soft delete a hotel (author or admin).
pub async fn delete(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

    let existing = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    if existing.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    service.delete(&id).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// Restore a soft-deleted hotel (admin only).
pub async fn restore(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Hotel>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let hotel = service.restore(&id).await?;
    Ok(Json(hotel))
}

/// Hard delete a hotel permanently (admin only — for trash cleanup).
pub async fn hard_delete(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());
    service.hard_delete(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// List soft-deleted hotels (admin trash view).
pub async fn list_deleted(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<TrashQuery>,
) -> Result<Json<PaginatedResponse<Hotel>>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(10).min(100).max(1);

    let (hotels, total) = service.list_deleted(page, limit).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: hotels,
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Update display order for a hotel (admin).
pub async fn update_display_order(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<Hotel>, ApiError> {
    let display_order = body
        .get("display_order")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);

    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let hotel = service.update_display_order(&id, display_order).await?;

    Ok(Json(hotel))
}

// ─── Branch Handlers ─────────────────────────────────────────────────────────

/// List branches for a hotel (public).
pub async fn list_branches(
    State(state): State<AppState>,
    user: OptionalUser,
    Path(hotel_id): Path<String>,
) -> Result<Json<Vec<HotelBranch>>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());

    let hotel = service
        .get_by_id(&hotel_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    let is_privileged = user
        .0
        .as_ref()
        .map_or(false, |u| u.role == UserRole::Admin || u.role == UserRole::Editor);
    if !is_privileged && hotel.status != ContentStatus::Published {
        return Err(ApiError::NotFound("Hotel not found".to_string()));
    }

    let branches = service.list_branches(&hotel_id).await?;
    Ok(Json(branches))
}

/// Add a branch to a hotel (admin/editor).
pub async fn add_branch(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(hotel_id): Path<String>,
    Json(input): Json<CreateBranchInput>,
) -> Result<Json<HotelBranch>, ApiError> {
    if input.name.trim().is_empty() {
        return Err(ApiError::ValidationError(
            "Branch name cannot be empty".to_string(),
        ));
    }

    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let hotel = service
        .get_by_id(&hotel_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    if hotel.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let branch = service
        .add_branch(
            &hotel_id,
            input.name.trim(),
            input.address.as_deref(),
            input.phone.as_deref(),
            input.email.as_deref(),
            input.coordinates.as_ref(),
            input.is_main.unwrap_or(false),
        )
        .await?;

    Ok(Json(branch))
}

/// Update a branch (admin/editor).
pub async fn update_branch(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path((hotel_id, branch_id)): Path<(String, String)>,
    Json(input): Json<UpdateBranchInput>,
) -> Result<Json<HotelBranch>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let hotel = service
        .get_by_id(&hotel_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    if hotel.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let branch = service
        .get_branch_by_id(&branch_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Branch not found".to_string()))?;

    if branch.hotel_id != hotel.id {
        return Err(ApiError::NotFound("Branch not found".to_string()));
    }

    let branch = service
        .update_branch(
            &branch_id,
            input.name.as_deref(),
            input.address.as_deref(),
            input.phone.as_deref(),
            input.email.as_deref(),
            input.coordinates.as_ref(),
            input.is_main,
        )
        .await?;

    Ok(Json(branch))
}

/// Remove a branch (admin/editor).
pub async fn remove_branch(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path((hotel_id, branch_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = HotelService::new(state.db.clone(), state.cache.clone());
    let hotel = service
        .get_by_id(&hotel_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

    if hotel.author_id != user.id && user.role != crate::models::user::UserRole::Admin {
        return Err(ApiError::Forbidden);
    }

    let branch = service
        .get_branch_by_id(&branch_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Branch not found".to_string()))?;

    if branch.hotel_id != hotel.id {
        return Err(ApiError::NotFound("Branch not found".to_string()));
    }

    service.remove_branch(&branch_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}
