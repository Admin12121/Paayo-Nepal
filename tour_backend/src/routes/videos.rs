use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public routes
        .route("/", get(handlers::videos::list))
        .route("/by-slug/:slug", get(handlers::videos::get_by_slug))
        // Admin trash view (must be before /:id to avoid conflict)
        .route("/trash", get(handlers::videos::list_deleted))
        // CRUD by ID
        .route("/", post(handlers::videos::create))
        .route("/:id", get(handlers::videos::get_by_id))
        .route("/:id", put(handlers::videos::update))
        .route("/:id", delete(handlers::videos::delete))
        // Status and admin actions
        .route("/:id/status", put(handlers::videos::update_status))
        .route("/:id/restore", post(handlers::videos::restore))
        .route("/:id/hard-delete", delete(handlers::videos::hard_delete))
        .route(
            "/:id/display-order",
            put(handlers::videos::update_display_order),
        )
}
