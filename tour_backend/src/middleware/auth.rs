use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::{extractors::auth::AuthenticatedUser, models::user::UserRole, AppState};

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
    banned_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Extract the raw session token from cookies.
///
/// Checks multiple cookie names in priority order:
///   1. `paayo_session`                         — plain cookie set by `/api/auth/sync-session`
///                                                 (the primary mechanism when nginx routes
///                                                  browser requests directly to Rust)
///   2. `__Secure-better-auth.session_token`    — BetterAuth signed cookie (production, via proxy)
///   3. `better-auth.session_token`             — BetterAuth signed cookie (dev, via proxy)
///
/// The `paayo_session` cookie contains the exact raw token that is stored in
/// the `session.token` DB column, so Rust can look it up directly without
/// needing Next.js to decode BetterAuth's signed cookie.
fn extract_session_token(cookie_header: &str) -> Option<String> {
    // First pass: prefer the plain `paayo_session` cookie (fastest path)
    let mut better_auth_token: Option<&str> = None;

    for c in cookie_header.split(';') {
        let c = c.trim();
        if let Some(val) = c.strip_prefix("paayo_session=") {
            let val = val.trim();
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
        // Remember better-auth tokens as fallback (for proxy / dev scenarios)
        if better_auth_token.is_none() {
            if let Some(val) = c.strip_prefix("__Secure-better-auth.session_token=") {
                better_auth_token = Some(val);
            } else if let Some(val) = c.strip_prefix("better-auth.session_token=") {
                better_auth_token = Some(val);
            }
        }
    }

    better_auth_token.map(|t| t.to_string())
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .and_then(|c| c.to_str().ok())
        .unwrap_or("");

    tracing::debug!("Auth middleware - Cookie header: {:?}", cookie_header);

    let session_token = match extract_session_token(cookie_header) {
        Some(token) if !token.is_empty() => token,
        _ => {
            tracing::debug!("Auth middleware - No session token found");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    tracing::debug!("Auth middleware - Extracted token: {:?}", session_token);

    let session = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT s.id, s.user_id, s.token, u.email, u.name, u.role, u.is_active, u.banned_at
        FROM "session" s
        JOIN "user" u ON s.user_id = u.id
        WHERE s.token = $1 AND s.expires_at > NOW()
        "#,
    )
    .bind(&session_token)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error during auth: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let session = match session {
        Some(s) => s,
        None => {
            tracing::debug!("Auth middleware - No session found in DB for token");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    tracing::debug!("Auth middleware - User authenticated: {}", session.email);

    // Reject banned users immediately
    if session.banned_at.is_some() {
        tracing::debug!(
            "Auth middleware - User {} is banned, rejecting",
            session.email
        );
        return Err(StatusCode::FORBIDDEN);
    }

    // Reject inactive non-admin users
    if !session.is_active && session.role != "admin" {
        tracing::debug!(
            "Auth middleware - User {} is inactive, rejecting",
            session.email
        );
        return Err(StatusCode::FORBIDDEN);
    }

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
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .and_then(|c| c.to_str().ok())
        .unwrap_or("");

    if let Some(token) = extract_session_token(cookie_header) {
        if !token.is_empty() {
            if let Ok(Some(session)) = sqlx::query_as::<_, SessionRow>(
                r#"
                SELECT s.id, s.user_id, s.token, u.email, u.name, u.role, u.is_active, u.banned_at
                FROM "session" s
                JOIN "user" u ON s.user_id = u.id
                WHERE s.token = $1 AND s.expires_at > NOW()
                "#,
            )
            .bind(&token)
            .fetch_optional(&state.db)
            .await
            {
                // Skip populating the auth extension for banned or inactive users.
                // This means handler-level extractors (AuthenticatedUser, AdminUser,
                // etc.) will see them as unauthenticated rather than authenticated-
                // but-inactive. This is the correct behavior: banned/inactive users
                // should not be able to perform ANY authenticated action.
                if session.banned_at.is_some() {
                    tracing::debug!(
                        "Optional auth - User {} is banned, skipping auth extension",
                        session.email
                    );
                } else if !session.is_active && session.role != "admin" {
                    tracing::debug!(
                        "Optional auth - User {} is inactive, skipping auth extension",
                        session.email
                    );
                } else {
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
    }

    next.run(request).await
}
