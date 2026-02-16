//! CSRF Protection — Double-Submit Cookie Pattern
//!
//! How it works:
//!   1. On every response, if the client doesn't already have a `paayo_csrf`
//!      cookie, the middleware generates a cryptographically random token and
//!      sets it as a cookie (SameSite=Lax, **not** HttpOnly — JS must be able
//!      to read it).
//!   2. On state-changing requests (POST / PUT / DELETE / PATCH), the
//!      middleware requires an `X-CSRF-Token` header whose value matches the
//!      `paayo_csrf` cookie exactly.
//!   3. An attacker on a different origin can cause the browser to *send* the
//!      cookie automatically, but cannot *read* it (same-origin policy), so
//!      they cannot set the matching header → request is rejected.
//!
//! Exemptions:
//!   - Safe/idempotent methods: GET, HEAD, OPTIONS
//!   - Health check endpoint: `/api/health`
//!   - SSE stream: `/api/notifications/stream` (GET-only, but listed for clarity)
//!   - Multipart uploads still need the header — the frontend reads the cookie
//!     and attaches the header before uploading.

use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::Response,
};
use rand::RngCore;

/// Cookie name — deliberately NOT HttpOnly so client JS can read it.
const CSRF_COOKIE_NAME: &str = "paayo_csrf";

/// Header the client must send with state-changing requests.
const CSRF_HEADER_NAME: &str = "x-csrf-token";
/// Header echoed back so clients can bootstrap token state.
const CSRF_RESPONSE_HEADER_NAME: &str = "x-csrf-token";

/// Length of the raw random bytes (32 bytes → 64 hex chars).
const TOKEN_BYTES: usize = 32;

/// Paths that are exempt from CSRF verification.
///
/// These are either:
///   - Inherently safe (health check)
///   - Only accept GET (SSE stream)
///   - Auth endpoints handled by Next.js (BetterAuth has its own CSRF)
const EXEMPT_PREFIXES: &[&str] = &["/api/health", "/api/notifications/stream", "/api/auth/"];

// ---------------------------------------------------------------------------
// Public middleware function
// ---------------------------------------------------------------------------

/// Axum middleware that enforces CSRF protection via the double-submit cookie
/// pattern.
///
/// Install this as a layer on the router **after** CORS (so preflight OPTIONS
/// requests are handled before reaching this middleware).
///
/// ```ignore
/// .layer(from_fn(csrf_middleware))
/// ```
pub async fn csrf_middleware(request: Request, next: Next) -> Result<Response<Body>, StatusCode> {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let secure_cookie = should_use_secure_cookie(&request);

    // 1. Safe methods — skip verification, but still set cookie if missing.
    let needs_verification = matches!(
        method,
        Method::POST | Method::PUT | Method::DELETE | Method::PATCH
    );

    // 2. Check exemptions
    let is_exempt = EXEMPT_PREFIXES
        .iter()
        .any(|prefix| path.starts_with(prefix));

    // 3. Extract the cookie value (if present)
    let cookie_token = extract_csrf_cookie(&request);

    // 4. Verify on state-changing, non-exempt requests
    if needs_verification && !is_exempt {
        let header_token = request
            .headers()
            .get(CSRF_HEADER_NAME)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        match (&cookie_token, &header_token) {
            (Some(cookie_val), Some(header_val)) if !cookie_val.is_empty() => {
                // Constant-time comparison to prevent timing attacks.
                if !constant_time_eq(cookie_val.as_bytes(), header_val.as_bytes()) {
                    tracing::warn!(
                        "CSRF token mismatch on {} {} (cookie present, header mismatch)",
                        method,
                        path
                    );
                    return Err(StatusCode::FORBIDDEN);
                }
            }
            _ => {
                tracing::warn!(
                    "CSRF token missing on {} {} (cookie: {}, header: {})",
                    method,
                    path,
                    cookie_token.is_some(),
                    header_token.is_some()
                );
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }

    // 5. Run the actual handler
    let mut response = next.run(request).await;

    // 6. If the client doesn't have a CSRF cookie yet, set one.
    //    This ensures the very first page load provisions a token that
    //    subsequent mutations can use.
    let response_token = if let Some(existing_token) = cookie_token {
        existing_token
    } else {
        let new_token = generate_token();
        if let Ok(cookie_value) = build_csrf_cookie(&new_token, secure_cookie) {
            response
                .headers_mut()
                .append(header::SET_COOKIE, cookie_value);
        }
        new_token
    };

    if let Ok(header_token) = HeaderValue::from_str(&response_token) {
        response.headers_mut().insert(
            header::HeaderName::from_static(CSRF_RESPONSE_HEADER_NAME),
            header_token,
        );
    }

    Ok(response)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the `paayo_csrf` cookie value from the request.
fn extract_csrf_cookie(request: &Request) -> Option<String> {
    let cookie_header = request.headers().get(header::COOKIE)?.to_str().ok()?;

    for c in cookie_header.split(';') {
        let c = c.trim();
        if let Some(val) = c.strip_prefix("paayo_csrf=") {
            let val = val.trim();
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }

    None
}

/// Generate a cryptographically random CSRF token (hex-encoded).
fn generate_token() -> String {
    let mut buf = [0u8; TOKEN_BYTES];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

/// Build the `Set-Cookie` header value for the CSRF cookie.
///
/// Properties:
///   - `SameSite=Lax`  — sent on top-level navigations + same-site requests.
///                        Not sent on cross-site sub-requests (img, script, fetch
///                        from attacker page). Combined with the header requirement,
///                        this provides robust CSRF protection.
///   - `Path=/`        — available to all paths.
///   - NOT `HttpOnly`  — JavaScript **must** be able to read this cookie to set
///                        the `X-CSRF-Token` header.
///   - `Secure`        — Only sent over HTTPS. In development (HTTP), the browser
///                        may still set it on localhost. We conditionally omit
///                        `Secure` if the env var `CSRF_INSECURE_DEV` is set
///                        to allow plain HTTP in local development.
///   - `Max-Age`       — 24 hours (86400 seconds). The token is long-lived within
///                        a session; a new one is generated if the cookie expires
///                        or is cleared.
fn build_csrf_cookie(token: &str, secure: bool) -> Result<HeaderValue, header::InvalidHeaderValue> {
    let secure_flag = if secure { "; Secure" } else { "" };

    let cookie = format!(
        "{}={}; Path=/; SameSite=Lax; Max-Age=86400{}",
        CSRF_COOKIE_NAME, token, secure_flag
    );

    HeaderValue::from_str(&cookie)
}

/// Decide whether the CSRF cookie should include the Secure attribute.
///
/// Rules:
/// - `CSRF_INSECURE_DEV` env var forces insecure cookies (local HTTP dev).
/// - If `x-forwarded-proto` is present, we follow it.
/// - Otherwise default to secure for safety.
fn should_use_secure_cookie(request: &Request) -> bool {
    if std::env::var("CSRF_INSECURE_DEV").is_ok() {
        return false;
    }

    if let Some(proto) = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
    {
        return proto.eq_ignore_ascii_case("https");
    }

    true
}

/// Constant-time byte comparison to prevent timing side-channels.
///
/// Returns `true` if both slices are equal in length and content.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }

    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_time_eq() {
        assert!(constant_time_eq(b"hello", b"hello"));
        assert!(!constant_time_eq(b"hello", b"world"));
        assert!(!constant_time_eq(b"hello", b"hell"));
        assert!(!constant_time_eq(b"", b"a"));
        assert!(constant_time_eq(b"", b""));
    }

    #[test]
    fn test_generate_token_length() {
        let token = generate_token();
        // 32 bytes → 64 hex characters
        assert_eq!(token.len(), TOKEN_BYTES * 2);
    }

    #[test]
    fn test_generate_token_uniqueness() {
        let t1 = generate_token();
        let t2 = generate_token();
        assert_ne!(t1, t2, "Two generated tokens should differ");
    }

    #[test]
    fn test_build_csrf_cookie_secure() {
        // Without CSRF_INSECURE_DEV, cookie should contain Secure flag
        std::env::remove_var("CSRF_INSECURE_DEV");
        let val = build_csrf_cookie("abc123", true).unwrap();
        let s = val.to_str().unwrap();
        assert!(s.contains("paayo_csrf=abc123"));
        assert!(s.contains("SameSite=Lax"));
        assert!(s.contains("Path=/"));
        assert!(s.contains("Max-Age=86400"));
        assert!(s.contains("Secure"));
        assert!(!s.contains("HttpOnly"));
    }

    #[test]
    fn test_build_csrf_cookie_insecure() {
        let val = build_csrf_cookie("abc123", false).unwrap();
        let s = val.to_str().unwrap();
        assert!(!s.contains("Secure"));
    }
}
