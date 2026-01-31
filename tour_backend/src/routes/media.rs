use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(handlers::media::list).post(handlers::media::upload),
        )
        .route("/gallery", get(handlers::media::gallery))
        .route(
            "/:id",
            get(handlers::media::get).delete(handlers::media::delete),
        )
}
