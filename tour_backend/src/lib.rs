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
use services::{
    ActivityService, AttractionService, CacheService, CommentService, ContentLinkService,
    EventService, HeroSlideService, HotelService, ImageService, LikeService, MediaService,
    NotificationService, PhotoFeatureService, PostService, RegionService, SearchService,
    TagService, VideoService, ViewService,
};

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub redis: redis::aio::ConnectionManager,
    pub settings: Arc<Settings>,
    pub cache: CacheService,
    pub image_service: Arc<ImageService>,
}

// ---------------------------------------------------------------------------
// Service factory methods (fix 5.16)
//
// Instead of constructing services ad-hoc in every handler (which risks
// inconsistent initialization — e.g. forgetting to pass Redis to
// NotificationService), these methods guarantee each service is created with
// all required dependencies.
//
// Cloning PgPool, CacheService, and ConnectionManager is very cheap (they
// are internally Arc-based), so per-request construction is fine for
// correctness. The factories just make it ergonomic and consistent.
// ---------------------------------------------------------------------------
impl AppState {
    // ---- Core content services -------------------------------------------

    /// Create a [`PostService`] with DB + cache.
    pub fn post_service(&self) -> PostService {
        PostService::new(self.db.clone(), self.cache.clone())
    }

    /// Create an [`EventService`] with DB + cache.
    pub fn event_service(&self) -> EventService {
        EventService::new(self.db.clone(), self.cache.clone())
    }

    /// Create an [`AttractionService`] with DB + cache.
    pub fn attraction_service(&self) -> AttractionService {
        AttractionService::new(self.db.clone(), self.cache.clone())
    }

    /// Create an [`ActivityService`] with DB + cache.
    pub fn activity_service(&self) -> ActivityService {
        ActivityService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`RegionService`] with DB + cache.
    pub fn region_service(&self) -> RegionService {
        RegionService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`HotelService`] with DB + cache.
    pub fn hotel_service(&self) -> HotelService {
        HotelService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`VideoService`] with DB + cache.
    pub fn video_service(&self) -> VideoService {
        VideoService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`PhotoFeatureService`] with DB + cache.
    pub fn photo_feature_service(&self) -> PhotoFeatureService {
        PhotoFeatureService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`HeroSlideService`] with DB + cache.
    pub fn hero_slide_service(&self) -> HeroSlideService {
        HeroSlideService::new(self.db.clone(), self.cache.clone())
    }

    // ---- Engagement services ---------------------------------------------

    /// Create a [`LikeService`] with DB.
    pub fn like_service(&self) -> LikeService {
        LikeService::new(self.db.clone())
    }

    /// Create a [`ViewService`] with DB.
    pub fn view_service(&self) -> ViewService {
        ViewService::new(self.db.clone())
    }

    /// Create a [`CommentService`] with DB + cache.
    pub fn comment_service(&self) -> CommentService {
        CommentService::new(self.db.clone(), self.cache.clone())
    }

    // ---- Notification service --------------------------------------------

    /// Create a [`NotificationService`] **with Redis** for real-time SSE
    /// publishing. This is the preferred constructor — always use this unless
    /// you explicitly only need read-only DB queries (rare).
    ///
    /// Previous code sometimes used `NotificationService::new()` (without
    /// Redis), which silently skipped publishing count updates and new
    /// notification events. Using this factory avoids that mistake.
    pub fn notification_service(&self) -> NotificationService {
        NotificationService::with_redis(self.db.clone(), self.redis.clone())
    }

    /// Create a read-only [`NotificationService`] without Redis.
    ///
    /// Only use this when you are certain no Redis publishing is needed
    /// (e.g., inside an SSE polling fallback that only reads unread counts).
    pub fn notification_service_readonly(&self) -> NotificationService {
        NotificationService::new(self.db.clone())
    }

    // ---- Supporting services ---------------------------------------------

    /// Create a [`TagService`] with DB + cache.
    pub fn tag_service(&self) -> TagService {
        TagService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`MediaService`] with DB + cache.
    pub fn media_service(&self) -> MediaService {
        MediaService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`SearchService`] with DB + cache.
    pub fn search_service(&self) -> SearchService {
        SearchService::new(self.db.clone(), self.cache.clone())
    }

    /// Create a [`ContentLinkService`] with DB + cache.
    pub fn content_link_service(&self) -> ContentLinkService {
        ContentLinkService::new(self.db.clone(), self.cache.clone())
    }
}
