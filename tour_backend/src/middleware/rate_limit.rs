use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::{num::NonZeroU32, sync::Arc};

pub type SharedRateLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>;

/// Create a rate limiter with the specified requests per minute
pub fn create_rate_limiter(requests_per_minute: u32) -> SharedRateLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
    Arc::new(RateLimiter::direct(quota))
}

/// Rate limit error response
pub struct RateLimitError;

impl IntoResponse for RateLimitError {
    fn into_response(self) -> Response {
        (
            StatusCode::TOO_MANY_REQUESTS,
            "Rate limit exceeded. Please try again later.",
        )
            .into_response()
    }
}

/// Check rate limit (returns error if exceeded)
pub fn check_rate_limit(limiter: &SharedRateLimiter) -> Result<(), RateLimitError> {
    match limiter.check() {
        Ok(_) => Ok(()),
        Err(_) => Err(RateLimitError),
    }
}
