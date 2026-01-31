use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::events::list).post(handlers::events::create),
        )
        .route("/upcoming", get(handlers::events::upcoming))
        .route(
            "/:slug",
            get(handlers::events::get_by_slug)
                .put(handlers::events::update)
                .delete(handlers::events::delete),
        )
}
