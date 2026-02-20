pub mod auth;
pub mod cache_control;
pub mod csrf;
pub mod logging;
pub mod rate_limit;
pub mod request_id;

pub use auth::{auth_middleware, optional_auth_middleware, require_role};
// UserRole is now defined in models::user — import from there, not from middleware
pub use crate::models::user::UserRole;
pub use cache_control::auto_cache_middleware;
pub use csrf::csrf_middleware;
pub use rate_limit::{PerIpRateLimiter, PerUserRateLimiter, RateLimitPresets};
pub use request_id::{request_id_middleware, RequestId};
