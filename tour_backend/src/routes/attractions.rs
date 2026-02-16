use axum::{routing::get, Router};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::attractions::list).post(handlers::attractions::create),
        )
        .route("/top", get(handlers::attractions::top))
        .route(
            "/:slug",
            get(handlers::attractions::get_by_slug)
                .put(handlers::attractions::update)
                .delete(handlers::attractions::delete),
        )
}
