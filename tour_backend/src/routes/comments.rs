use axum::{
    routing::{delete, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/:id",
            put(handlers::comments::update).delete(handlers::comments::delete),
        )
        .route("/:id/like", post(handlers::comments::like))
}
