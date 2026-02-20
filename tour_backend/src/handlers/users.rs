use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    error::ApiError,
    extractors::auth::AdminUser,
    handlers::posts::PaginatedResponse,
    services::user_service::{ListUsersFilter, UserCounts, UserListItem},
    services::UserService,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub role: Option<String>,
    pub status: Option<String>, // "active", "pending", "blocked"
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangeRoleInput {
    pub role: String,
}

pub async fn list(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<PaginatedResponse<UserListItem>>, ApiError> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100);

    let service = UserService::new(state.db.clone());
    let filter = ListUsersFilter {
        role: query.role,
        status: query.status,
        search: query.search,
    };

    let (users, total) = service.list(page, limit, &filter).await?;
    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: users,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn get_by_id(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<UserListItem>, ApiError> {
    let service = UserService::new(state.db.clone());
    let user = service
        .get_by_id(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound("User not found".to_string()))?;

    Ok(Json(user))
}

pub async fn activate(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = UserService::new(state.db.clone());
    service.activate(&id).await?;

    // Notify the editor that their account has been activated (real-time via SSE)
    let notif_service = state.notification_service();
    let _ = notif_service
        .notify_user(
            &id,
            Some(&admin.0.id),
            "verified",
            "Account Activated",
            Some("Your account has been verified and activated by an administrator. You can now create and manage content."),
            None,
            None,
            Some("/dashboard"),
        )
        .await;

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn deactivate(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = UserService::new(state.db.clone());
    service.deactivate(&id).await?;

    // Notify the editor that their account has been deactivated
    let notif_service = state.notification_service();
    let _ = notif_service
        .notify_user(
            &id,
            Some(&admin.0.id),
            "verified",
            "Account Deactivated",
            Some("Your account has been deactivated by an administrator. Content creation is now disabled until reactivation."),
            None,
            None,
            Some("/dashboard"),
        )
        .await;

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn block(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = UserService::new(state.db.clone());
    service.block(&id).await?;

    // Notify the user that their account has been blocked
    let notif_service = state.notification_service();
    let _ = notif_service
        .notify_user(
            &id,
            Some(&admin.0.id),
            "verified",
            "Account Blocked",
            Some("Your account has been blocked by an administrator. Please contact support if you believe this is an error."),
            None,
            None,
            None,
        )
        .await;

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn unblock(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = UserService::new(state.db.clone());
    service.unblock(&id).await?;

    // Notify the user that their account has been unblocked
    let notif_service = state.notification_service();
    let _ = notif_service
        .notify_user(
            &id,
            Some(&admin.0.id),
            "verified",
            "Account Unblocked",
            Some("Your account has been unblocked and reactivated. You can now access the platform again."),
            None,
            None,
            Some("/dashboard"),
        )
        .await;

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn change_role(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<ChangeRoleInput>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = UserService::new(state.db.clone());
    service.change_role(&id, &input.role).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn delete_user(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = UserService::new(state.db.clone());
    let deleted = service.delete(&id).await?;

    if !deleted {
        return Err(ApiError::BadRequest(
            "Cannot delete admin users".to_string(),
        ));
    }

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn counts(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<UserCounts>, ApiError> {
    let service = UserService::new(state.db.clone());
    let counts = service.get_counts().await?;
    Ok(Json(counts))
}
