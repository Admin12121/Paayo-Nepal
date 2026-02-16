use axum::{routing::get, Router};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::regions::list).post(handlers::regions::create),
        )
        .route(
            "/:slug",
            get(handlers::regions::get_by_slug)
                .put(handlers::regions::update)
                .delete(handlers::regions::delete),
        )
        .route("/:slug/attractions", get(handlers::regions::attractions))
}
