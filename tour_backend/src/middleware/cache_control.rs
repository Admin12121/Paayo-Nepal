use axum::{
    extract::Request,
    http::{header, HeaderValue},
    middleware::Next,
    response::Response,
};

/// Cache-Control preset durations (in seconds).
pub mod durations {
    /// No caching at all — dynamic/authenticated responses.
    pub const NO_CACHE: &str = "no-store, no-cache, must-revalidate, max-age=0";

    /// Short cache for frequently changing public data (e.g., listings, search results).
    /// 60 seconds with stale-while-revalidate for smooth UX.
    pub const SHORT: &str = "public, max-age=60, stale-while-revalidate=30";

    /// Medium cache for semi-static content (e.g., individual post pages, hotel details).
    /// 5 minutes with 1 minute stale grace.
    pub const MEDIUM: &str = "public, max-age=300, stale-while-revalidate=60";

    /// Long cache for rarely changing content (e.g., hero slides, regions).
    /// 1 hour with 5 minute stale grace.
    pub const LONG: &str = "public, max-age=3600, stale-while-revalidate=300";

    /// Immutable cache for static assets (uploaded images, etc.).
    /// 1 year, immutable — the filename/hash changes when the content changes.
    pub const IMMUTABLE: &str = "public, max-age=31536000, immutable";

    /// Private cache for user-specific data (notifications, user profile).
    /// 30 seconds, private (not shared caches).
    pub const PRIVATE_SHORT: &str = "private, max-age=30, must-revalidate";
}

/// Middleware that sets `Cache-Control: no-store` on all responses.
///
/// Apply this to protected/authenticated route groups where caching is never appropriate.
/// This is the safest default for any route that returns user-specific data.
pub async fn no_cache_middleware(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    set_cache_header(&mut response, durations::NO_CACHE);
    response
}

/// Middleware that sets a short public Cache-Control header.
///
/// Good for: listing endpoints, search results, paginated feeds.
pub async fn short_cache_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let mut response = next.run(request).await;

    // Only cache GET and HEAD requests; mutating methods get no-store.
    if method == axum::http::Method::GET || method == axum::http::Method::HEAD {
        set_cache_header(&mut response, durations::SHORT);
    } else {
        set_cache_header(&mut response, durations::NO_CACHE);
    }

    response
}

/// Middleware that sets a medium public Cache-Control header.
///
/// Good for: individual content detail endpoints (post by slug, video by slug, hotel by slug).
pub async fn medium_cache_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let mut response = next.run(request).await;

    if method == axum::http::Method::GET || method == axum::http::Method::HEAD {
        set_cache_header(&mut response, durations::MEDIUM);
    } else {
        set_cache_header(&mut response, durations::NO_CACHE);
    }

    response
}

/// Middleware that sets a long public Cache-Control header.
///
/// Good for: hero slides, region lists, tag lists — data that changes infrequently.
pub async fn long_cache_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let mut response = next.run(request).await;

    if method == axum::http::Method::GET || method == axum::http::Method::HEAD {
        set_cache_header(&mut response, durations::LONG);
    } else {
        set_cache_header(&mut response, durations::NO_CACHE);
    }

    response
}

/// Middleware that sets an immutable Cache-Control header.
///
/// Good for: static file serving (uploaded images, thumbnails).
/// Only use this when file URLs include a content hash or version.
pub async fn immutable_cache_middleware(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    set_cache_header(&mut response, durations::IMMUTABLE);
    response
}

/// Middleware that sets a private short-lived Cache-Control header.
///
/// Good for: authenticated endpoints that return user-specific but non-sensitive data
/// (e.g., notification counts, user preferences).
pub async fn private_cache_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let mut response = next.run(request).await;

    if method == axum::http::Method::GET || method == axum::http::Method::HEAD {
        set_cache_header(&mut response, durations::PRIVATE_SHORT);
    } else {
        set_cache_header(&mut response, durations::NO_CACHE);
    }

    response
}

/// Smart auto-detecting middleware that picks a cache policy based on the request path.
///
/// This can be applied as a blanket layer on the entire API router. It inspects the
/// URI path to decide which caching policy to use:
///
/// - `/api/health` → long
/// - `/api/hero-slides` → long (GET only)
/// - `/api/regions`, `/api/tags` → medium (GET only)
/// - `/api/posts`, `/api/videos`, `/api/photos`, `/api/hotels` → short (GET only)
/// - `/api/search` → short (GET only)
/// - `/api/notifications`, `/api/users` → no-cache (always)
/// - `/uploads/` → immutable
/// - Everything else (POST, PUT, DELETE, unknown) → no-cache
pub async fn auto_cache_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    let mut response = next.run(request).await;

    // Mutating methods never get cached.
    if method != axum::http::Method::GET && method != axum::http::Method::HEAD {
        set_cache_header(&mut response, durations::NO_CACHE);
        return response;
    }

    // Match path patterns to cache tiers.
    let directive = if path.starts_with("/uploads/") {
        durations::IMMUTABLE
    } else if path == "/api/health" {
        durations::LONG
    } else if path.starts_with("/api/hero-slides") || path.starts_with("/api/hero_slides") {
        durations::LONG
    } else if path.starts_with("/api/regions") || path.starts_with("/api/tags") {
        durations::MEDIUM
    } else if path.starts_with("/api/posts")
        || path.starts_with("/api/videos")
        || path.starts_with("/api/photos")
        || path.starts_with("/api/photo-features")
        || path.starts_with("/api/hotels")
        || path.starts_with("/api/search")
    {
        durations::SHORT
    } else if path.starts_with("/api/notifications")
        || path.starts_with("/api/users")
        || path.starts_with("/api/views")
        || path.starts_with("/api/content")
    {
        // User-specific or write-adjacent endpoints — never cache publicly.
        durations::NO_CACHE
    } else {
        // Unknown routes default to no-cache for safety.
        durations::NO_CACHE
    };

    set_cache_header(&mut response, directive);
    response
}

/// Helper: insert the Cache-Control header, but only if the response doesn't already have one
/// (so handlers can override on a per-response basis).
fn set_cache_header(response: &mut Response, value: &str) {
    if !response.headers().contains_key(header::CACHE_CONTROL) {
        if let Ok(hv) = HeaderValue::from_str(value) {
            response.headers_mut().insert(header::CACHE_CONTROL, hv);
        }
    }
}
