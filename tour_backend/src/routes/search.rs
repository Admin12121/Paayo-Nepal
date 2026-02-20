use axum::{routing::get, Router};

use crate::{handlers, AppState};

pub fn routes() -> Router<AppState> {
    Router::new().route("/", get(handlers::search::global_search))
}
