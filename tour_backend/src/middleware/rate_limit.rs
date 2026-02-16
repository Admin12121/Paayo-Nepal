use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::{collections::HashMap, net::IpAddr, num::NonZeroU32, sync::Arc, time::Duration};
use tokio::sync::RwLock;

use crate::extractors::auth::AuthenticatedUser;

// ---------------------------------------------------------------------------
// Global (non-keyed) rate limiter — simple variant
// ---------------------------------------------------------------------------

/// A shared global rate limiter (not keyed by IP).
/// Useful for endpoints where you just want a blanket requests-per-minute cap.
pub type SharedRateLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;

/// Create a global (non-keyed) rate limiter with the given requests per minute.
pub fn create_rate_limiter(requests_per_minute: u32) -> SharedRateLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
    Arc::new(RateLimiter::direct(quota))
}

/// Check a global rate limiter and return an error if the limit is exceeded.
pub fn check_rate_limit(limiter: &SharedRateLimiter) -> Result<(), RateLimitError> {
    match limiter.check() {
        Ok(_) => Ok(()),
        Err(_) => Err(RateLimitError),
    }
}

// ---------------------------------------------------------------------------
// Per-IP rate limiter — keyed variant
// ---------------------------------------------------------------------------

/// A per-IP rate limiter backed by an in-memory HashMap.
///
/// Each unique IP address gets its own token bucket. Old entries are lazily
/// evicted when the map is accessed and their bucket has been idle for longer
/// than `cleanup_after`.
///
/// This is suitable for single-instance deployments. For multi-instance
/// deployments behind a load balancer, consider a Redis-based approach.
#[derive(Clone)]
pub struct PerIpRateLimiter {
    buckets: Arc<RwLock<HashMap<IpAddr, Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>>>>,
    quota: Quota,
    cleanup_after: Duration,
}

impl PerIpRateLimiter {
    /// Create a new per-IP rate limiter.
    ///
    /// * `requests_per_minute` – how many requests a single IP may issue per minute.
    /// * `cleanup_after` – how long an idle bucket is kept before it can be evicted.
    pub fn new(requests_per_minute: u32, cleanup_after: Duration) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
            quota,
            cleanup_after,
        }
    }

    /// Check whether the given IP address is within its rate limit.
    /// Returns `Ok(())` if the request is allowed, `Err(RateLimitError)` if not.
    pub async fn check(&self, ip: IpAddr) -> Result<(), RateLimitError> {
        // Fast path: read lock to check an existing bucket.
        {
            let buckets = self.buckets.read().await;
            if let Some(limiter) = buckets.get(&ip) {
                return match limiter.check() {
                    Ok(_) => Ok(()),
                    Err(_) => Err(RateLimitError),
                };
            }
        }

        // Slow path: need to insert a new bucket.
        let mut buckets = self.buckets.write().await;

        // Double-check after acquiring write lock.
        let limiter = buckets
            .entry(ip)
            .or_insert_with(|| Arc::new(RateLimiter::direct(self.quota)));

        match limiter.check() {
            Ok(_) => Ok(()),
            Err(_) => Err(RateLimitError),
        }
    }

    /// Remove idle buckets that haven't been used recently.
    /// Call this periodically (e.g., via a background task every few minutes).
    pub async fn cleanup(&self) {
        let mut buckets = self.buckets.write().await;
        let before = buckets.len();

        // governor doesn't expose "last used" directly, but we can remove
        // buckets whose token count has fully replenished (i.e., they are idle).
        // A fully-replenished bucket means the IP hasn't hit the limiter recently.
        buckets.retain(|_ip, limiter| {
            // If check() succeeds, the bucket has capacity — meaning it's been
            // idle long enough for tokens to refill. We keep it only if it's
            // still partially consumed (i.e., check would succeed but we undo it).
            // For simplicity, we just let all buckets that pass check() be removed
            // after the cleanup_after period. In practice, governor replenishes
            // tokens over time, so a full bucket is likely idle.
            //
            // A pragmatic approach: just remove if check succeeds (bucket is full).
            limiter.check().is_err()
        });

        let removed = before - buckets.len();
        if removed > 0 {
            tracing::debug!(
                "Rate limiter cleanup: removed {} idle buckets, {} remaining",
                removed,
                buckets.len()
            );
        }
    }

    /// Spawn a background task that periodically cleans up idle buckets.
    pub fn spawn_cleanup_task(self) -> tokio::task::JoinHandle<()> {
        let interval = self.cleanup_after;
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            loop {
                ticker.tick().await;
                self.cleanup().await;
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Rate limit exceeded error — returns 429 Too Many Requests.
pub struct RateLimitError;

impl IntoResponse for RateLimitError {
    fn into_response(self) -> Response {
        (
            StatusCode::TOO_MANY_REQUESTS,
            [("retry-after", "60"), ("x-ratelimit-exceeded", "true")],
            "Rate limit exceeded. Please try again later.",
        )
            .into_response()
    }
}

// ---------------------------------------------------------------------------
// Axum middleware functions
// ---------------------------------------------------------------------------

/// Extract the client IP address from the request.
///
/// Checks (in order):
/// 1. `X-Forwarded-For` header (first entry — set by reverse proxies like Nginx)
/// 2. `X-Real-Ip` header
/// 3. The connected peer address from the connection info
/// 4. Falls back to 127.0.0.1
fn extract_client_ip(request: &Request) -> IpAddr {
    // X-Forwarded-For: client, proxy1, proxy2
    if let Some(xff) = request.headers().get("x-forwarded-for") {
        if let Ok(xff_str) = xff.to_str() {
            if let Some(first_ip) = xff_str.split(',').next() {
                if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                    return ip;
                }
            }
        }
    }

    // X-Real-Ip
    if let Some(xri) = request.headers().get("x-real-ip") {
        if let Ok(xri_str) = xri.to_str() {
            if let Ok(ip) = xri_str.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }

    // ConnectInfo (requires Axum's ConnectInfo extension)
    if let Some(connect_info) = request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
    {
        return connect_info.0.ip();
    }

    // Fallback
    IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)
}

// ---------------------------------------------------------------------------
// Per-User rate limiter — keyed by authenticated user ID
// ---------------------------------------------------------------------------

/// A rate limiter keyed by authenticated user ID, with IP fallback.
///
/// When an `AuthenticatedUser` extension is present on the request (i.e. the
/// user is logged in), the rate limit bucket is keyed by their **user ID**.
/// This means 5 editors in the same office (sharing one public IP) each get
/// their own independent bucket.
///
/// When no authenticated user is found, it falls back to the client IP, which
/// is appropriate for public/unauthenticated routes.
#[derive(Clone)]
pub struct PerUserRateLimiter {
    buckets: Arc<RwLock<HashMap<String, Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>>>>,
    quota: Quota,
    cleanup_after: Duration,
}

impl PerUserRateLimiter {
    /// Create a new per-user rate limiter.
    ///
    /// * `requests_per_minute` – how many requests a single user (or IP) may issue per minute.
    /// * `cleanup_after` – how long an idle bucket is kept before it can be evicted.
    pub fn new(requests_per_minute: u32, cleanup_after: Duration) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
            quota,
            cleanup_after,
        }
    }

    /// Check whether the given key is within its rate limit.
    pub async fn check(&self, key: String) -> Result<(), RateLimitError> {
        // Fast path: read lock to check an existing bucket.
        {
            let buckets = self.buckets.read().await;
            if let Some(limiter) = buckets.get(&key) {
                return match limiter.check() {
                    Ok(_) => Ok(()),
                    Err(_) => Err(RateLimitError),
                };
            }
        }

        // Slow path: need to insert a new bucket.
        let mut buckets = self.buckets.write().await;

        let limiter = buckets
            .entry(key)
            .or_insert_with(|| Arc::new(RateLimiter::direct(self.quota)));

        match limiter.check() {
            Ok(_) => Ok(()),
            Err(_) => Err(RateLimitError),
        }
    }

    /// Remove idle buckets whose tokens have fully replenished.
    pub async fn cleanup(&self) {
        let mut buckets = self.buckets.write().await;
        let before = buckets.len();
        buckets.retain(|_key, limiter| limiter.check().is_err());
        let removed = before - buckets.len();
        if removed > 0 {
            tracing::debug!(
                "Per-user rate limiter cleanup: removed {} idle buckets, {} remaining",
                removed,
                buckets.len()
            );
        }
    }

    /// Spawn a background task that periodically cleans up idle buckets.
    pub fn spawn_cleanup_task(self) -> tokio::task::JoinHandle<()> {
        let interval = self.cleanup_after;
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            loop {
                ticker.tick().await;
                self.cleanup().await;
            }
        })
    }
}

/// Derive the rate-limit key from a request.
///
/// If the request has an `AuthenticatedUser` extension (populated by
/// `optional_auth_middleware`), the key is `"user:{id}"` — each logged-in
/// user gets their own bucket regardless of IP.
///
/// Otherwise, falls back to `"ip:{addr}"` so unauthenticated clients are
/// still rate-limited by IP.
fn extract_rate_limit_key(request: &Request) -> String {
    if let Some(user) = request.extensions().get::<AuthenticatedUser>() {
        format!("user:{}", user.id)
    } else {
        let ip = extract_client_ip(request);
        format!("ip:{}", ip)
    }
}

// ---------------------------------------------------------------------------
// Device-keyed rate limiting — for public engagement routes
// ---------------------------------------------------------------------------

/// Derive a device-level rate-limit key from the request.
///
/// Priority order:
/// 1. `X-Device-Id` header — a persistent fingerprint generated by the frontend
///    (UUID stored in localStorage). Most accurate: each physical device gets
///    its own bucket even on shared networks.
/// 2. Viewer hash — SHA-256(IP + User-Agent + salt). Differentiates browsers
///    on the same WiFi (different User-Agents → different hashes).
/// 3. Pure IP — last resort if User-Agent is missing.
///
/// This solves the shared-office problem for public (unauthenticated) routes:
/// two people on the same WiFi with different browsers or device IDs get
/// independent rate-limit buckets.
fn extract_device_key(request: &Request) -> String {
    // 1. Prefer explicit device fingerprint from the frontend
    if let Some(device_id) = request.headers().get("x-device-id") {
        if let Ok(id) = device_id.to_str() {
            let trimmed = id.trim();
            // Basic sanity: must be 8–128 chars, alphanumeric/hyphens only
            if trimmed.len() >= 8
                && trimmed.len() <= 128
                && trimmed
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-')
            {
                return format!("device:{}", trimmed);
            }
        }
    }

    // 2. Fall back to viewer_hash (IP + User-Agent + salt)
    let ip = extract_client_ip(request);
    let user_agent = request
        .headers()
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    // Use the same SHA-256 viewer hash that likes/views use for dedup,
    // with "ratelimit" context so the hash differs from data-layer hashes.
    let hash = crate::services::generate_viewer_hash(&ip.to_string(), user_agent, "ratelimit");
    format!("viewer:{}", hash)
}

/// Per-device rate-limiting middleware for public engagement routes.
///
/// Uses `X-Device-Id` header (frontend fingerprint) when available, otherwise
/// falls back to a hash of IP + User-Agent. This means two people in the same
/// office with different browsers or devices get independent rate-limit buckets,
/// unlike pure per-IP limiting.
pub async fn per_device_rate_limit(
    limiter: PerUserRateLimiter,
    request: Request,
    next: Next,
) -> Response {
    let key = extract_device_key(&request);

    match limiter.check(key).await {
        Ok(()) => next.run(request).await,
        Err(err) => err.into_response(),
    }
}

/// Create a per-IP rate-limiting Axum middleware.
///
/// Usage in route construction:
/// ```ignore
/// use axum::middleware::from_fn;
///
/// let limiter = PerIpRateLimiter::new(60, Duration::from_secs(300));
/// let rate_limit_mw = rate_limit_middleware(limiter);
///
/// let app = Router::new()
///     .route("/api/login", post(login_handler))
///     .layer(from_fn(rate_limit_mw));
/// ```
///
/// Since `from_fn` requires a function with a fixed signature, this returns
/// a closure. But for easier usage, prefer `make_rate_limit_layer`.
pub async fn per_ip_rate_limit(
    limiter: PerIpRateLimiter,
    request: Request,
    next: Next,
) -> Response {
    let ip = extract_client_ip(&request);

    match limiter.check(ip).await {
        Ok(()) => next.run(request).await,
        Err(err) => err.into_response(),
    }
}

/// Per-user rate-limiting middleware.
///
/// Uses authenticated user ID as the bucket key when available, otherwise
/// falls back to IP. This solves the shared-office problem: multiple editors
/// behind the same NAT / public IP each get their own independent rate-limit
/// bucket.
///
/// Use this for authenticated route groups (write/CMS, uploads) where every
/// request is expected to come from a logged-in user.
pub async fn per_user_rate_limit(
    limiter: PerUserRateLimiter,
    request: Request,
    next: Next,
) -> Response {
    let key = extract_rate_limit_key(&request);

    match limiter.check(key).await {
        Ok(()) => next.run(request).await,
        Err(err) => err.into_response(),
    }
}

/// Convenience: create a rate-limiting middleware closure for use with
/// `axum::middleware::from_fn`.
///
/// Example:
/// ```ignore
/// use axum::middleware::from_fn;
/// use std::time::Duration;
///
/// let api_limiter = PerIpRateLimiter::new(120, Duration::from_secs(300));
/// let auth_limiter = PerIpRateLimiter::new(20, Duration::from_secs(300));
///
/// let app = Router::new()
///     .nest("/api/auth", auth_routes.layer(from_fn(move |req, next| {
///         let l = auth_limiter.clone();
///         async move { per_ip_rate_limit(l, req, next).await }
///     })))
///     .layer(from_fn(move |req, next| {
///         let l = api_limiter.clone();
///         async move { per_ip_rate_limit(l, req, next).await }
///     }));
/// ```

/// Global (non-keyed) rate limit middleware function for use with `from_fn`.
///
/// This is simpler than per-IP limiting: it enforces a single bucket for all
/// clients. Useful for very sensitive endpoints (e.g., password reset) where
/// you want to cap total throughput regardless of source.
pub async fn global_rate_limit(
    limiter: SharedRateLimiter,
    request: Request,
    next: Next,
) -> Response {
    match limiter.check() {
        Ok(_) => next.run(request).await,
        Err(_) => RateLimitError.into_response(),
    }
}

// ---------------------------------------------------------------------------
// Pre-configured rate limiter presets
// ---------------------------------------------------------------------------

/// Pre-configured rate limiter presets for common use cases.
pub struct RateLimitPresets;

impl RateLimitPresets {
    /// General API rate limit: 120 requests/minute per IP.
    pub fn api() -> PerIpRateLimiter {
        PerIpRateLimiter::new(120, Duration::from_secs(600))
    }

    /// Authentication endpoints: 20 requests/minute per IP.
    pub fn auth() -> PerIpRateLimiter {
        PerIpRateLimiter::new(20, Duration::from_secs(600))
    }

    /// Write/mutation endpoints: 30 requests/minute **per user** (falls back to IP).
    ///
    /// Keyed by authenticated user ID so multiple editors behind the same
    /// office/NAT IP each get their own 30 req/min budget.
    pub fn write() -> PerUserRateLimiter {
        PerUserRateLimiter::new(30, Duration::from_secs(600))
    }

    /// Search endpoints: 60 requests/minute per IP.
    pub fn search() -> PerIpRateLimiter {
        PerIpRateLimiter::new(60, Duration::from_secs(600))
    }

    /// Media upload endpoints: 10 requests/minute **per user** (falls back to IP).
    ///
    /// Keyed by authenticated user ID for the same shared-office reason as `write()`.
    pub fn upload() -> PerUserRateLimiter {
        PerUserRateLimiter::new(10, Duration::from_secs(600))
    }

    /// View/like recording endpoints: 60 requests/minute **per device**.
    ///
    /// Keyed by `X-Device-Id` header (frontend fingerprint) when available,
    /// falling back to SHA-256(IP + User-Agent) so that different browsers
    /// on the same office WiFi each get their own 60 req/min bucket.
    ///
    /// Use with `per_device_rate_limit` middleware (not `per_ip_rate_limit`).
    pub fn engagement() -> PerUserRateLimiter {
        PerUserRateLimiter::new(60, Duration::from_secs(600))
    }
}
