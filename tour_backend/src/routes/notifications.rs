use axum::{
    routing::{get, post},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::notifications::list))
        .route("/unread-count", get(handlers::notifications::unread_count))
        .route("/stream", get(handlers::notifications::stream))
        .route("/:id/read", post(handlers::notifications::mark_read))
        .route("/read-all", post(handlers::notifications::mark_all_read))
}
