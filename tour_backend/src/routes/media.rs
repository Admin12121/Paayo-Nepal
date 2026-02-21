use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
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
        .route("/cleanup", post(handlers::media::cleanup))
        .route(
            "/{id}",
            get(handlers::media::get).delete(handlers::media::delete),
        )
        // Allow uploads up to 22MB (20MB file + multipart overhead)
        .layer(DefaultBodyLimit::max(22 * 1024 * 1024))
}
