use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public routes
        .route("/", get(handlers::hotels::list))
        .route("/by-slug/:slug", get(handlers::hotels::get_by_slug))
        // Admin trash view (must be before /:id to avoid conflict)
        .route("/trash", get(handlers::hotels::list_deleted))
        // CRUD by ID
        .route("/", post(handlers::hotels::create))
        .route("/:id", get(handlers::hotels::get_by_id))
        .route("/:id", put(handlers::hotels::update))
        .route("/:id", delete(handlers::hotels::delete))
        // Status and admin actions
        .route("/:id/status", put(handlers::hotels::update_status))
        .route("/:id/restore", post(handlers::hotels::restore))
        .route("/:id/hard-delete", delete(handlers::hotels::hard_delete))
        .route(
            "/:id/display-order",
            put(handlers::hotels::update_display_order),
        )
        // Branch management
        .route("/:hotel_id/branches", get(handlers::hotels::list_branches))
        .route("/:hotel_id/branches", post(handlers::hotels::add_branch))
        .route(
            "/:hotel_id/branches/:branch_id",
            put(handlers::hotels::update_branch),
        )
        .route(
            "/:hotel_id/branches/:branch_id",
            delete(handlers::hotels::remove_branch),
        )
}
