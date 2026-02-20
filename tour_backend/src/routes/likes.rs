use axum::{
    routing::{get, post},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
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
}
