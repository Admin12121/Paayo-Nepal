use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public route — active resolved slides for the homepage carousel
        .route("/", get(handlers::hero_slides::list_resolved))
        // Admin routes (auth checked via AdminUser extractor)
        .route("/admin", get(handlers::hero_slides::list_all))
        .route("/admin/counts", get(handlers::hero_slides::counts))
        .route("/admin/reorder", put(handlers::hero_slides::reorder))
        .route("/", post(handlers::hero_slides::create))
        .route("/:id", get(handlers::hero_slides::get_by_id))
        .route("/:id", put(handlers::hero_slides::update))
        .route("/:id", delete(handlers::hero_slides::delete))
        .route("/:id/toggle", post(handlers::hero_slides::toggle_active))
}
