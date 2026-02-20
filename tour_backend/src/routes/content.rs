use axum::{
    routing::{get, post, put},
    Router,
};

use crate::{handlers, AppState};

/// Combined content routes — merges likes and content tagging endpoints
/// under a single `/content` prefix to avoid duplicate nest conflicts.
///
/// Mounted at: `/api/content`
///
/// Routes:
///   POST /:target_type/:target_id/like         — Toggle like (public)
///   GET  /:target_type/:target_id/like-status   — Get like status (public)
///   GET  /:target_type/top                      — Top liked content (public)
///   GET  /:target_type/:target_id/tags          — Get tags for content (public)
///   PUT  /:target_type/:target_id/tags          — Set tags by ID (admin)
///   PUT  /:target_type/:target_id/tags/by-name  — Set tags by name (admin)
pub fn routes() -> Router<AppState> {
    Router::new()
        // ── Likes ────────────────────────────────────────────────────────
        // Toggle like for a content item (public — uses IP+UA hash for dedup)
        .route(
            "/:target_type/:target_id/like",
            post(handlers::likes::toggle_like),
        )
        // Get like status for a content item from this viewer's perspective (public)
        .route(
            "/:target_type/:target_id/like-status",
            get(handlers::likes::get_like_status),
        )
        // Get top liked content for a given type (public)
        .route("/:target_type/top", get(handlers::likes::top_liked))
        // ── Content Tags ─────────────────────────────────────────────────
        // Get tags for a content item (public)
        .route(
            "/:target_type/:target_id/tags",
            get(handlers::tags::get_content_tags),
        )
        // Set tags for a content item by tag IDs (admin)
        .route(
            "/:target_type/:target_id/tags",
            put(handlers::tags::set_content_tags),
        )
        // Set tags for a content item by tag names (admin — creates tags if needed)
        .route(
            "/:target_type/:target_id/tags/by-name",
            put(handlers::tags::set_content_tags_by_name),
        )
}
