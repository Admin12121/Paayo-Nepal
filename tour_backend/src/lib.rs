use std::sync::Arc;

pub mod config;
pub mod error;
pub mod extractors;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod services;
pub mod utils;

use config::Settings;
use services::{CacheService, ImageService};

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::MySqlPool,
    pub redis: redis::aio::ConnectionManager,
    pub settings: Arc<Settings>,
    pub cache: CacheService,
    pub image_service: Arc<ImageService>,
}
