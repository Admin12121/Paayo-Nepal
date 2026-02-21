use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public routes
        .route("/", get(handlers::tags::list))
        .route("/search", get(handlers::tags::search))
        .route("/count", get(handlers::tags::count))
        .route("/by-slug/{slug}", get(handlers::tags::get_by_slug))
        .route("/{id}/content", get(handlers::tags::content_by_tag))
        // Admin CRUD (auth checked via AdminUser extractor)
        .route("/", post(handlers::tags::create))
        .route("/{id}", get(handlers::tags::get_by_id))
        .route("/{id}", put(handlers::tags::update))
        .route("/{id}", delete(handlers::tags::delete))
}

/// Content tagging routes — mounted under /api/content
/// These handle the association between tags and content items.
pub fn content_tag_routes() -> Router<AppState> {
    Router::new()
        // Get tags for a content item (public)
        .route(
            "/{target_type}/{target_id}/tags",
            get(handlers::tags::get_content_tags),
        )
        // Set tags for a content item by tag IDs (admin)
        .route(
            "/{target_type}/{target_id}/tags",
            put(handlers::tags::set_content_tags),
        )
        // Set tags for a content item by tag names (admin — creates tags if needed)
        .route(
            "/{target_type}/{target_id}/tags/by-name",
            put(handlers::tags::set_content_tags_by_name),
        )
}
