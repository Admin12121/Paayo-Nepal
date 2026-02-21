use axum::http::{header, Method};
use axum::middleware::from_fn;
use axum::middleware::from_fn_with_state;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer, cors::CorsLayer, services::ServeDir, trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use tour_backend::config::Settings;
use tour_backend::middleware::rate_limit::per_ip_rate_limit;
use tour_backend::middleware::{
    auto_cache_middleware, csrf_middleware, optional_auth_middleware, request_id_middleware,
    RateLimitPresets,
};
use tour_backend::services::{spawn_media_cleanup_task, CacheService, ImageService};
use tour_backend::{routes, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tour_backend=info,tower_http=warn,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let settings = Arc::new(Settings::new()?);

    tracing::info!("Starting Paayo Nepal API server...");

    // Database connection pool (PostgreSQL)
    let db = PgPoolOptions::new()
        .max_connections(settings.database.max_connections)
        .min_connections(settings.database.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&settings.database.url)
        .await?;

    tracing::info!("PostgreSQL connection established");

    // Run migrations
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("Failed to run database migrations");
    tracing::info!("Database migrations completed");

    // Seed admin user if not exists (credentials from env)
    tour_backend::config::database::seed_admin(&db, &settings)
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

    // -----------------------------------------------------------------------
    // Rate limiters — per-IP, with background cleanup
    //
    // Each limiter gives EACH IP its own independent token bucket.
    // E.g. api_limiter at 120 req/min means each unique IP can do 120/min;
    // 10,000 concurrent users each get their own 120/min allowance.
    // -----------------------------------------------------------------------
    let api_limiter = RateLimitPresets::api(); // 120 req/min per IP — general reads
    let engagement_limiter = RateLimitPresets::engagement(); // 60 req/min per DEVICE — likes/views/comment create
    let write_limiter = RateLimitPresets::write(); // 30 req/min per USER — CMS write/mutation
    let upload_limiter = RateLimitPresets::upload(); // 10 req/min per USER — media uploads

    // Spawn background cleanup tasks for each limiter
    let _api_cleanup = api_limiter.clone().spawn_cleanup_task();
    let _engagement_cleanup = engagement_limiter.clone().spawn_cleanup_task();
    let _write_cleanup = write_limiter.clone().spawn_cleanup_task();
    let _upload_cleanup = upload_limiter.clone().spawn_cleanup_task();

    tracing::info!("Rate limiters initialized — api: 120/min per-IP, engagement: 60/min per-device, write: 30/min per-user, upload: 10/min per-user");

    // -----------------------------------------------------------------------
    // Background media cleanup — removes orphaned uploads
    //
    // Runs every 6 hours, deletes media records (and their files) that are
    // older than 24 hours and not referenced by any content entity (posts,
    // hotels, hero slides, photo features, regions, etc.).
    // -----------------------------------------------------------------------
    let _media_cleanup = spawn_media_cleanup_task(
        state.db.clone(),
        state.cache.clone(),
        state.image_service.clone(),
        6,  // run every 6 hours
        24, // only delete orphans older than 24 hours
    );
    tracing::info!("Media cleanup task spawned — interval: 6h, grace period: 24h");

    // -----------------------------------------------------------------------
    // CORS
    // -----------------------------------------------------------------------
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
            header::HeaderName::from_static("x-device-id"),
            header::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true);

    // -----------------------------------------------------------------------
    // Static file serving for uploads
    // -----------------------------------------------------------------------
    let upload_service = ServeDir::new(&settings.media.upload_path);

    // -----------------------------------------------------------------------
    // Build router with middleware stack
    // -----------------------------------------------------------------------
    //
    // KEY DESIGN DECISIONS:
    //
    // 1. **optional_auth_middleware** is applied to ALL API routes (not just
    //    "protected" ones). This populates `AuthenticatedUser` in request
    //    extensions whenever a valid session cookie is present, so handler-
    //    level extractors (AdminUser, ActiveEditorUser, etc.) work correctly
    //    even on "public" route groups.
    //
    // 2. **Tiered rate limiting**: Different route groups get different per-IP
    //    rate limits. The general `api_limiter` (120/min) is the outermost
    //    blanket, and tighter limiters are applied per route group:
    //      - Engagement (likes, views, comment POST): 60/min per IP
    //      - Write/CMS mutations: 30/min per IP
    //      - Media uploads: 10/min per IP
    //
    // 3. Routes that were previously "protected" (users, notifications) keep
    //    the mandatory `auth_middleware` layer so they 401 immediately if no
    //    valid session exists — no need to reach the handler.
    //
    // Middleware is applied bottom-up: the first `.layer()` wraps last
    // (outermost), so ordering here is:
    //   1. CORS              (outermost — handles preflight early)
    //   2. Compression
    //   3. Tracing
    //   4. Request ID        (generates / propagates x-request-id)
    //   5. Rate limiting     (blanket 120/min per IP for all /api routes)
    //   6. CSRF protection   (double-submit cookie — verify before auth)
    //   7. Optional auth     (parse session → populate AuthenticatedUser ext)
    //   8. Cache-Control     (auto-detects per path)
    //   9. Routes            (innermost — per-group rate limiters applied here)
    // -----------------------------------------------------------------------

    let api_limiter_for_layer = api_limiter.clone();

    let app = Router::new()
        .nest(
            "/api",
            routes::api_routes(
                state.clone(),
                engagement_limiter,
                write_limiter,
                upload_limiter,
            ),
        )
        .nest_service("/uploads", upload_service)
        // --- innermost layers first ---
        .layer(from_fn(auto_cache_middleware))
        // Optional auth on ALL routes — populates AuthenticatedUser extension
        // when a valid session cookie is present; passes through otherwise.
        .layer(from_fn_with_state(state.clone(), optional_auth_middleware))
        // CSRF protection — double-submit cookie pattern.
        // Verifies X-CSRF-Token header matches paayo_csrf cookie on
        // POST/PUT/DELETE/PATCH. Sets the cookie on first response.
        .layer(from_fn(csrf_middleware))
        // Blanket per-IP rate limit (120/min) — catches anything not covered
        // by a tighter per-group limiter
        .layer(from_fn(move |req, next| {
            let limiter = api_limiter_for_layer.clone();
            async move { per_ip_rate_limit(limiter, req, next).await }
        }))
        .layer(from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state);

    let addr = format!("{}:{}", settings.server.host, settings.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server running on http://{}", addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
