use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Unprocessable entity: {0}")]
    UnprocessableEntity(String),

    #[error("Too many requests")]
    TooManyRequests,

    #[error("Internal server error")]
    InternalServerError,

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Image processing error: {0}")]
    ImageError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<serde_json::Value>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match &self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg.clone()),
            ApiError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "Authentication required".to_string(),
            ),
            ApiError::Forbidden => (
                StatusCode::FORBIDDEN,
                "forbidden",
                "Access denied".to_string(),
            ),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, "not_found", msg.clone()),
            ApiError::Conflict(msg) => (StatusCode::CONFLICT, "conflict", msg.clone()),
            ApiError::UnprocessableEntity(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "unprocessable_entity",
                msg.clone(),
            ),
            ApiError::TooManyRequests => (
                StatusCode::TOO_MANY_REQUESTS,
                "too_many_requests",
                "Rate limit exceeded".to_string(),
            ),
            ApiError::InternalServerError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "Internal server error".to_string(),
            ),
            ApiError::DatabaseError(e) => {
                tracing::error!("Database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database_error",
                    "Database error occurred".to_string(),
                )
            }
            ApiError::RedisError(e) => {
                tracing::error!("Redis error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "cache_error",
                    "Cache error occurred".to_string(),
                )
            }
            ApiError::ValidationError(msg) => {
                (StatusCode::BAD_REQUEST, "validation_error", msg.clone())
            }
            ApiError::ImageError(msg) => (StatusCode::BAD_REQUEST, "image_error", msg.clone()),
        };

        let body = Json(ErrorResponse {
            error: error_type.to_string(),
            message,
            details: None,
        });

        (status, body).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        tracing::error!("Unexpected error: {:?}", err);
        ApiError::InternalServerError
    }
}

impl From<image::ImageError> for ApiError {
    fn from(err: image::ImageError) -> Self {
        ApiError::ImageError(err.to_string())
    }
}
