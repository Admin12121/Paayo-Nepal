use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    status: String,
    version: String,
    database: String,
    redis: String,
}

#[derive(Serialize)]
pub struct LiveResponse {
    status: String,
    version: String,
}

/// Lightweight liveness endpoint for container health checks.
///
/// Intentionally avoids DB/Redis checks to keep periodic probe logs quiet and
/// prevent probe traffic from generating SQL trace noise.
pub async fn live_check() -> Json<LiveResponse> {
    Json(LiveResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    // Check database connection
    let db_status = match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => "connected".to_string(),
        Err(_) => "disconnected".to_string(),
    };

    // Check Redis connection
    let redis_status = match redis::cmd("PING")
        .query_async::<_, String>(&mut state.redis.clone())
        .await
    {
        Ok(_) => "connected".to_string(),
        Err(_) => "disconnected".to_string(),
    };

    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database: db_status,
        redis: redis_status,
    })
}
