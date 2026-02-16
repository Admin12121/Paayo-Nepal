use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::users::list))
        .route("/counts", get(handlers::users::counts))
        .route("/:id", get(handlers::users::get_by_id))
        .route("/:id", delete(handlers::users::delete_user))
        .route("/:id/activate", post(handlers::users::activate))
        .route("/:id/deactivate", post(handlers::users::deactivate))
        .route("/:id/block", post(handlers::users::block))
        .route("/:id/unblock", post(handlers::users::unblock))
        .route("/:id/role", put(handlers::users::change_role))
}
