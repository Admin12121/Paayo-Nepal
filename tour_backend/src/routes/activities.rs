use axum::{routing::get, Router};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::activities::list).post(handlers::activities::create),
        )
        .route(
            "/{slug}",
            get(handlers::activities::get_by_slug)
                .put(handlers::activities::update)
                .delete(handlers::activities::delete),
        )
}
