use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public routes
        .route("/", get(handlers::photo_features::list))
        .route(
            "/by-slug/{slug}",
            get(handlers::photo_features::get_by_slug),
        )
        // Admin trash view (must be before /{id} to avoid conflict)
        .route("/trash", get(handlers::photo_features::list_deleted))
        // CRUD by ID
        .route("/", post(handlers::photo_features::create))
        .route("/{id}", get(handlers::photo_features::get_by_id))
        .route("/{id}", put(handlers::photo_features::update))
        .route("/{id}", delete(handlers::photo_features::delete))
        // Status and admin actions
        .route("/{id}/status", put(handlers::photo_features::update_status))
        .route("/{id}/restore", post(handlers::photo_features::restore))
        .route(
            "/{id}/hard-delete",
            delete(handlers::photo_features::hard_delete),
        )
        .route(
            "/{id}/display-order",
            put(handlers::photo_features::update_display_order),
        )
        // Image management
        .route(
            "/{photo_id}/images",
            get(handlers::photo_features::list_images),
        )
        .route(
            "/{photo_id}/images",
            post(handlers::photo_features::add_image),
        )
        .route(
            "/{photo_id}/images/reorder",
            put(handlers::photo_features::reorder_images),
        )
        .route(
            "/{photo_id}/images/{image_id}",
            put(handlers::photo_features::update_image),
        )
        .route(
            "/{photo_id}/images/{image_id}",
            delete(handlers::photo_features::remove_image),
        )
}
