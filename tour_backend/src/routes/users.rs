use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::users::list))
        .route("/:id/activate", post(handlers::users::activate))
        .route("/:id/deactivate", post(handlers::users::deactivate))
        .route("/:id/block", post(handlers::users::block))
        .route("/:id/unblock", post(handlers::users::unblock))
        .route("/:id", delete(handlers::users::delete_user))
}
