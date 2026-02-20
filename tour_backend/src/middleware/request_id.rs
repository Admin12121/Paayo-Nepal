use axum::{
    extract::Request,
    http::{header::HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

/// Header name for the request ID
pub static REQUEST_ID_HEADER: HeaderName = HeaderName::from_static("x-request-id");

/// Middleware that assigns a unique request ID to every request.
///
/// - If the incoming request already carries an `x-request-id` header, it is
///   preserved (useful when a reverse-proxy in front already generated one).
/// - Otherwise a new UUID v4 is generated.
/// - The request ID is always copied to the response headers so callers can
///   correlate responses with log entries.
/// - The ID is also inserted into the request extensions so handlers and other
///   middleware can access it via `request.extensions().get::<RequestId>()`.
pub async fn request_id_middleware(mut request: Request, next: Next) -> Response {
    // Reuse an existing request ID from the incoming headers, or generate a new one.
    let id = request
        .headers()
        .get(&REQUEST_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Store in request extensions so downstream handlers can access it.
    request.extensions_mut().insert(RequestId(id.clone()));

    // Attach the request ID to the tracing span for structured logging.
    let _span = tracing::info_span!("request", request_id = %id);

    let mut response = next.run(request).await;

    // Always echo the request ID back in the response headers.
    if let Ok(value) = HeaderValue::from_str(&id) {
        response.headers_mut().insert(&REQUEST_ID_HEADER, value);
    }

    response
}

/// A typed wrapper around the request ID string, stored in request extensions.
///
/// Handlers can extract this via:
/// ```ignore
/// use axum::Extension;
/// use crate::middleware::request_id::RequestId;
///
/// async fn my_handler(Extension(req_id): Extension<RequestId>) -> String {
///     format!("Your request ID is {}", req_id.0)
/// }
/// ```
#[derive(Debug, Clone)]
pub struct RequestId(pub String);

impl std::fmt::Display for RequestId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
