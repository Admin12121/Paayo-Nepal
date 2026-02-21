use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};

use crate::models::user::UserRole;

/// Authenticated user extracted from request extensions
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub role: UserRole,
    pub is_active: bool,
}

impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

/// Optional authenticated user - doesn't fail if not present
#[derive(Debug, Clone)]
pub struct OptionalUser(pub Option<AuthenticatedUser>);

impl<S> FromRequestParts<S> for OptionalUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Ok(OptionalUser(
            parts.extensions.get::<AuthenticatedUser>().cloned(),
        ))
    }
}

/// Require admin role
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthenticatedUser);

impl<S> FromRequestParts<S> for AdminUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user = parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if user.role != UserRole::Admin {
            return Err(StatusCode::FORBIDDEN);
        }

        Ok(AdminUser(user))
    }
}

/// Require editor or admin role
#[derive(Debug, Clone)]
pub struct EditorUser(pub AuthenticatedUser);

impl<S> FromRequestParts<S> for EditorUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user = parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if user.role != UserRole::Admin && user.role != UserRole::Editor {
            return Err(StatusCode::FORBIDDEN);
        }

        Ok(EditorUser(user))
    }
}

/// Require editor/admin role AND active account (admin always active)
#[derive(Debug, Clone)]
pub struct ActiveEditorUser(pub AuthenticatedUser);

impl<S> FromRequestParts<S> for ActiveEditorUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user = parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)?;

        // Admin always passes
        if user.role == UserRole::Admin {
            return Ok(ActiveEditorUser(user));
        }

        // Editor must be active
        if user.role == UserRole::Editor && user.is_active {
            return Ok(ActiveEditorUser(user));
        }

        Err(StatusCode::FORBIDDEN)
    }
}
