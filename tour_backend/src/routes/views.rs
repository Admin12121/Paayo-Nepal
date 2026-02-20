use axum::{
    routing::{get, post},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public routes
        .route("/", post(handlers::views::record_view))
        .route("/:target_type/:target_id", get(handlers::views::get_stats))
        .route("/trending/:target_type", get(handlers::views::trending))
        // Admin routes (auth checked via AdminUser extractor)
        .route(
            "/:target_type/:target_id/daily",
            get(handlers::views::daily_stats),
        )
        .route("/admin/summary", get(handlers::views::summary))
        .route("/admin/aggregate", post(handlers::views::aggregate))
        .route("/admin/prune", post(handlers::views::prune))
}
