use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use sqlx::MySqlPool;

use crate::extractors::auth::AuthenticatedUser;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserRole {
    Admin,
    Editor,
    User,
}

impl From<&str> for UserRole {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "admin" => UserRole::Admin,
            "editor" => UserRole::Editor,
            _ => UserRole::User,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct SessionRow {
    #[allow(dead_code)]
    id: String,
    user_id: String,
    #[allow(dead_code)]
    token: String,
    email: String,
    name: Option<String>,
    role: String,
    is_active: bool,
}

pub async fn auth_middleware(
    State(db): State<MySqlPool>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .and_then(|c| c.to_str().ok())
        .unwrap_or("");

    let session_token = cookie_header
        .split(';')
        .find_map(|c| {
            let c = c.trim();
            if let Some(val) = c.strip_prefix("__Secure-better-auth.session_token=") {
                Some(val)
            } else {
                c.strip_prefix("better-auth.session_token=")
            }
        })
        .map(|token| {
            let token = token.split('.').next().unwrap_or(token);
            token.to_string()
        });

    let session_token = match session_token {
        Some(token) if !token.is_empty() => token,
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT s.id, s.user_id, s.token, u.email, u.name, u.role, u.is_active
        FROM session s
        JOIN user u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > NOW()
        "#,
    )
    .bind(&session_token)
    .fetch_optional(&db)
    .await
    .map_err(|e| {
        tracing::error!("Database error during auth: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::UNAUTHORIZED)?;

    let user = AuthenticatedUser {
        id: session.user_id,
        email: session.email,
        name: session.name,
        role: UserRole::from(session.role.as_str()),
        is_active: session.is_active,
    };

    request.extensions_mut().insert(user);
    Ok(next.run(request).await)
}

pub async fn require_role(
    required_role: UserRole,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let user = request
        .extensions()
        .get::<AuthenticatedUser>()
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let has_permission = match required_role {
        UserRole::Admin => user.role == UserRole::Admin,
        UserRole::Editor => user.role == UserRole::Admin || user.role == UserRole::Editor,
        UserRole::User => true,
    };

    if !has_permission {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}


pub async fn optional_auth_middleware(
    State(db): State<MySqlPool>,
    mut request: Request,
    next: Next,
) -> Response {
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .and_then(|c| c.to_str().ok())
        .unwrap_or("");

    let session_token = cookie_header
        .split(';')
        .find_map(|c| {
            let c = c.trim();
            if let Some(val) = c.strip_prefix("__Secure-better-auth.session_token=") {
                Some(val)
            } else {
                c.strip_prefix("better-auth.session_token=")
            }
        })
        .map(|token| {
            let token = token.split('.').next().unwrap_or(token);
            token.to_string()
        });

    if let Some(token) = session_token {
        if !token.is_empty() {
            // Try to verify session
            if let Ok(Some(session)) = sqlx::query_as::<_, SessionRow>(
                r#"
                SELECT s.id, s.user_id, s.token, u.email, u.name, u.role, u.is_active
                FROM session s
                JOIN user u ON s.user_id = u.id
                WHERE s.token = ? AND s.expires_at > NOW()
                "#,
            )
            .bind(&token)
            .fetch_optional(&db)
            .await
            {
                let user = AuthenticatedUser {
                    id: session.user_id,
                    email: session.email,
                    name: session.name,
                    role: UserRole::from(session.role.as_str()),
                    is_active: session.is_active,
                };
                request.extensions_mut().insert(user);
            }
        }
    }

    next.run(request).await
}
