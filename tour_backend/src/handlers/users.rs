use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{
    error::ApiError, extractors::auth::AdminUser, handlers::posts::PaginatedResponse, AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserListItem {
    pub id: String,
    pub email: String,
    pub email_verified: bool,
    pub name: Option<String>,
    pub image: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub banned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub role: Option<String>,
    pub status: Option<String>, // "active", "pending", "blocked"
    pub search: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<ListUsersQuery>,
) -> Result<Json<PaginatedResponse<UserListItem>>, ApiError> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = (page - 1) * limit;

    let mut where_clauses = vec!["1=1".to_string()];
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref role) = query.role {
        if !role.is_empty() {
            where_clauses.push("`role` = ?".to_string());
            bind_values.push(role.clone());
        }
    }

    if let Some(ref status) = query.status {
        match status.as_str() {
            "active" => where_clauses.push("`is_active` = 1 AND `banned_at` IS NULL".to_string()),
            "pending" => where_clauses.push("`is_active` = 0 AND `banned_at` IS NULL".to_string()),
            "blocked" => where_clauses.push("`banned_at` IS NOT NULL".to_string()),
            _ => {}
        }
    }

    if let Some(ref search) = query.search {
        if !search.is_empty() {
            where_clauses.push("(`name` LIKE ? OR `email` LIKE ?)".to_string());
            let pattern = format!("%{}%", search);
            bind_values.push(pattern.clone());
            bind_values.push(pattern);
        }
    }

    let where_sql = where_clauses.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM `user` WHERE {}", where_sql);
    let list_sql = format!(
        "SELECT `id`, `email`, `email_verified`, `name`, `image`, `role`, `is_active`, `banned_at`, `created_at`, `updated_at` FROM `user` WHERE {} ORDER BY `created_at` DESC LIMIT ? OFFSET ?",
        where_sql
    );

    // Build count query
    let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql);
    for val in &bind_values {
        count_query = count_query.bind(val);
    }
    let (total,) = count_query.fetch_one(&state.db).await?;

    // Build list query
    let mut list_query = sqlx::query_as::<_, UserListItem>(&list_sql);
    for val in &bind_values {
        list_query = list_query.bind(val);
    }
    list_query = list_query.bind(limit).bind(offset);
    let users = list_query.fetch_all(&state.db).await?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as i32;

    Ok(Json(PaginatedResponse {
        data: users,
        total,
        page,
        limit,
        total_pages,
    }))
}

pub async fn activate(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query("UPDATE `user` SET `is_active` = 1, `banned_at` = NULL WHERE `id` = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn deactivate(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Prevent deactivating admin users
    let user: Option<(String,)> = sqlx::query_as("SELECT `role` FROM `user` WHERE `id` = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    if let Some((role,)) = user {
        if role == "admin" {
            return Err(ApiError::Forbidden);
        }
    }
    sqlx::query("UPDATE `user` SET `is_active` = 0 WHERE `id` = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn block(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Block user: deactivate + set banned_at + delete all sessions
    sqlx::query(
        "UPDATE `user` SET `is_active` = 0, `banned_at` = NOW() WHERE `id` = ? AND `role` != 'admin'",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;

    // Delete all sessions to force logout
    sqlx::query("DELETE FROM `session` WHERE `user_id` = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn unblock(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query("UPDATE `user` SET `is_active` = 1, `banned_at` = NULL WHERE `id` = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn delete_user(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Prevent deleting admin users
    let result = sqlx::query("DELETE FROM `user` WHERE `id` = ? AND `role` != 'admin'")
        .bind(&id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::BadRequest(
            "Cannot delete admin users".to_string(),
        ));
    }

    Ok(Json(serde_json::json!({"success": true})))
}
