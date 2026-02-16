use axum::{middleware::from_fn, middleware::from_fn_with_state, routing::get, Router};

use crate::{
    middleware::{
        auth_middleware,
        rate_limit::{per_device_rate_limit, per_user_rate_limit},
        PerUserRateLimiter,
    },
    AppState,
};

pub mod activities;
pub mod attractions;
pub mod comments;
pub mod content;
pub mod content_links;
pub mod events;
mod health;
pub mod hero_slides;
pub mod hotels;
pub mod likes;
pub mod media;
pub mod notifications;
pub mod photo_features;
pub mod posts;
pub mod regions;
pub mod search;
pub mod tags;
pub mod users;
pub mod videos;
pub mod views;

/// Build all API routes with proper auth middleware and tiered rate limiting.
///
/// ## Auth strategy
///
/// `optional_auth_middleware` is applied globally (in main.rs) so that the
/// `AuthenticatedUser` extension is populated whenever a valid session cookie
/// is present.  Handler-level extractors (`AdminUser`, `ActiveEditorUser`,
/// `EditorUser`, `AuthenticatedUser`) then enforce the required role.
///
/// Routes that **must** reject unauthenticated requests early (before reaching
/// the handler) additionally get the mandatory `auth_middleware` layer — this
/// is used for `/users` and `/notifications` which have no public endpoints.
///
/// ## Rate-limiting tiers (all per-IP)
///
/// | Tier         | Limit      | Route groups                               |
/// |--------------|------------|--------------------------------------------|
/// | api (blanket)| 120 req/min| everything under /api (applied in main.rs) |
/// | engagement   |  60 req/min| likes, views, comment creation              |
/// | write        |  30 req/min| CMS create/update/delete, tags mutation     |
/// | upload       |  10 req/min| media upload                               |
///
/// The blanket limiter is the outermost layer (applied in `main.rs`).
/// Tighter per-group limiters are applied here as inner layers so a request
/// must pass **both** the blanket and the group limiter.
pub fn api_routes(
    state: AppState,
    engagement_limiter: PerUserRateLimiter,
    write_limiter: PerUserRateLimiter,
    upload_limiter: PerUserRateLimiter,
) -> Router<AppState> {
    // -----------------------------------------------------------------
    // Mandatory-auth routes — 401 immediately if no valid session
    // -----------------------------------------------------------------
    let mandatory_auth = Router::new()
        // User management (admin only via extractors)
        .nest("/users", users::routes())
        // Notifications (any authenticated user)
        .nest("/notifications", notifications::routes())
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // -----------------------------------------------------------------
    // Engagement routes — public but tightly rate-limited (60/min per device)
    //   • POST /views           (record view)
    //   • POST /content/:t/:id/like (toggle like)
    //   • GET  /content/:t/:id/like-status
    //   • POST /comments        (create guest comment)
    //
    // Uses per-device keying: X-Device-Id header (frontend fingerprint)
    // → SHA-256(IP + User-Agent) fallback. Multiple people on the same
    // office WiFi with different browsers each get their own 60 req/min.
    // -----------------------------------------------------------------
    let engagement_limiter_clone = engagement_limiter.clone();
    let engagement = Router::new()
        .nest("/views", views::routes())
        .nest("/content", content::routes())
        .nest("/comments", comments::routes())
        .layer(from_fn(move |req, next| {
            let limiter = engagement_limiter_clone.clone();
            async move { per_device_rate_limit(limiter, req, next).await }
        }));

    // -----------------------------------------------------------------
    // Write/CMS routes — require auth via extractors, rate-limited 30/min
    //   Covers create / update / delete on posts, events, attractions,
    //   activities, regions, hotels, videos, photos, hero-slides, tags.
    //
    //   NOTE: These routers also serve public GET endpoints (list, get_by_slug).
    //   The write rate limiter applies to ALL verbs in these groups, but since
    //   the blanket api limiter is already 120/min for reads the tighter 30/min
    //   effectively only matters for write-heavy usage patterns.
    // -----------------------------------------------------------------
    let write_limiter_clone = write_limiter.clone();
    let cms_write = Router::new()
        .nest("/posts", posts::routes())
        .nest("/events", events::routes())
        .nest("/attractions", attractions::routes())
        .nest("/activities", activities::routes())
        .nest("/regions", regions::routes())
        .nest("/hotels", hotels::routes())
        .nest("/videos", videos::routes())
        .nest("/photos", photo_features::routes())
        .nest("/hero-slides", hero_slides::routes())
        .nest("/tags", tags::routes())
        .nest("/content-links", content_links::routes())
        .layer(from_fn(move |req, next| {
            let limiter = write_limiter_clone.clone();
            async move { per_user_rate_limit(limiter, req, next).await }
        }));

    // -----------------------------------------------------------------
    // Upload routes — very tight rate limit (10/min per IP)
    // -----------------------------------------------------------------
    let upload_limiter_clone = upload_limiter.clone();
    let uploads = Router::new()
        .nest("/media", media::routes())
        .layer(from_fn(move |req, next| {
            let limiter = upload_limiter_clone.clone();
            async move { per_user_rate_limit(limiter, req, next).await }
        }));

    // -----------------------------------------------------------------
    // Public read-only routes — no extra rate limiter beyond the blanket
    // -----------------------------------------------------------------
    let public_read = Router::new()
        .route("/health", get(health::health_check))
        .nest("/search", search::routes());

    // -----------------------------------------------------------------
    // Merge everything
    // -----------------------------------------------------------------
    Router::new()
        .merge(mandatory_auth)
        .merge(engagement)
        .merge(cms_write)
        .merge(uploads)
        .merge(public_read)
}
