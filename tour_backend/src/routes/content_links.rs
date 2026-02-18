use axum::{
    routing::{get, post, put},
    Router,
};

use crate::{handlers, AppState};

/// Content-links routes — CRUD for the `content_links` table.
///
/// Mounted at: `/api/content-links`
///
/// ## Public (read) routes
///
///   GET  /:source_type/:source_id        — List links for a source item
///   GET  /:source_type/:source_id/count  — Count links for a source item
///   GET  /target/:target_type/:target_id — List links pointing to a target
///   GET  /by-id/:id                      — Get a single link by ID
///
/// ## Editor/Admin (write) routes
///
///   POST /                               — Create a single content link
///   PUT  /by-id/:id                      — Update display order of a link
///   DELETE /by-id/:id                    — Delete a single link
///   PUT  /:source_type/:source_id        — Batch-set links for a source (replace all)
///   DELETE /:source_type/:source_id      — Delete all links for a source
pub fn routes() -> Router<AppState> {
    Router::new()
        // ── Public read endpoints ────────────────────────────────────────
        .route(
            "/:source_type/:source_id",
            get(handlers::content_links::list_for_source),
        )
        .route(
            "/:source_type/:source_id/count",
            get(handlers::content_links::count_for_source),
        )
        .route(
            "/target/:target_type/:target_id",
            get(handlers::content_links::list_for_target),
        )
        .route("/by-id/:id", get(handlers::content_links::get_by_id))
        // ── Admin write endpoints ────────────────────────────────────────
        .route("/", post(handlers::content_links::create))
        .route(
            "/by-id/:id",
            put(handlers::content_links::update).delete(handlers::content_links::delete),
        )
        .route(
            "/:source_type/:source_id",
            put(handlers::content_links::set_links)
                .delete(handlers::content_links::delete_all_for_source),
        )
}
