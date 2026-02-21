use axum::{
    routing::{get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::posts::list).post(handlers::posts::create),
        )
        .route(
            "/{slug}",
            get(handlers::posts::get_by_slug)
                .put(handlers::posts::update)
                .delete(handlers::posts::delete),
        )
        .route("/{id}/publish", post(handlers::posts::publish))
        .route("/{id}/status", put(handlers::posts::update_status))
        .route(
            "/{post_id}/comments",
            get(handlers::comments::list_for_post),
        )
}
