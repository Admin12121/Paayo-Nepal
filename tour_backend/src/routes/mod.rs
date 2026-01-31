use axum::{routing::get, Router};

use crate::AppState;

pub mod activities;
pub mod attractions;
pub mod comments;
pub mod events;
mod health;
pub mod media;
pub mod notifications;
pub mod posts;
pub mod regions;
pub mod search;
pub mod users;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        // Health check
        .route("/health", get(health::health_check))
        // Posts routes
        .nest("/posts", posts::routes())
        // Media routes
        .nest("/media", media::routes())
        // Comments routes
        .nest("/comments", comments::routes())
        // Events routes
        .nest("/events", events::routes())
        // Regions routes
        .nest("/regions", regions::routes())
        // Attractions routes
        .nest("/attractions", attractions::routes())
        // Activities routes
        .nest("/activities", activities::routes())
        // Search routes
        .nest("/search", search::routes())
        // User management routes (admin only)
        .nest("/users", users::routes())
        // Notification routes
        .nest("/notifications", notifications::routes())
}
