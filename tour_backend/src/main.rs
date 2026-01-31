use axum::http::{header, Method};
use axum::Router;
use sqlx::mysql::MySqlPoolOptions;
use std::sync::Arc;
use tower_http::{compression::CompressionLayer, cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use tour_backend::config::Settings;
use tour_backend::services::{CacheService, ImageService};
use tour_backend::{routes, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tour_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let settings = Arc::new(Settings::new()?);

    tracing::info!("Starting Nepal Tourism API server...");

    // Database connection pool
    let db = MySqlPoolOptions::new()
        .max_connections(settings.database.max_connections)
        .min_connections(settings.database.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&settings.database.url)
        .await?;

    tracing::info!("Database connection established");

    // Initialize database tables
    tour_backend::config::database::init_tables(&db)
        .await
        .expect("Failed to initialize database tables");

    // Seed admin user if not exists
    tour_backend::config::database::seed_admin(&db)
        .await
        .expect("Failed to seed admin user");

    // Redis connection
    let redis_client = redis::Client::open(settings.redis.url.clone())?;
    let redis = redis_client.get_connection_manager().await?;

    tracing::info!("Redis connection established");

    // Initialize cache service
    let cache = CacheService::new(redis.clone());

    // Initialize image service
    let image_service = ImageService::new(settings.media.upload_path.clone().into());
    image_service
        .ensure_upload_dir()
        .await
        .expect("Failed to create upload directory");
    let image_service = Arc::new(image_service);

    tracing::info!("Image service initialized");

    let state = AppState {
        db,
        redis,
        settings: settings.clone(),
        cache,
        image_service,
    };

    // Build CORS layer with allowed origins from config
    let allowed_origins: Vec<axum::http::HeaderValue> = settings
        .cors
        .allowed_origins
        .iter()
        .filter_map(|origin| {
            origin.parse::<axum::http::HeaderValue>().ok().or_else(|| {
                tracing::warn!("Invalid CORS origin, skipping: {}", origin);
                None
            })
        })
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::ORIGIN,
            header::COOKIE,
            header::SET_COOKIE,
            header::HeaderName::from_static("x-requested-with"),
        ])
        .allow_credentials(true);

    // Build router
    let app = Router::new()
        .nest("/api", routes::api_routes())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", settings.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server running on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
