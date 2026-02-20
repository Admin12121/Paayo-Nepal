use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        // Public routes
        .route("/", get(handlers::comments::list_for_content))
        .route("/post/:post_id", get(handlers::comments::list_for_post))
        .route("/", post(handlers::comments::create))
        .route("/:id/replies", get(handlers::comments::replies))
        // Admin moderation routes
        .route("/moderation", get(handlers::comments::list_for_moderation))
        .route(
            "/moderation/pending-count",
            get(handlers::comments::pending_count),
        )
        .route("/:id/approve", post(handlers::comments::approve))
        .route("/:id/reject", post(handlers::comments::reject))
        .route("/:id/spam", post(handlers::comments::mark_spam))
        .route("/:id", delete(handlers::comments::delete))
        // Batch operations
        .route("/batch/approve", post(handlers::comments::batch_approve))
        .route("/batch/delete", post(handlers::comments::batch_delete))
}
