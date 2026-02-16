-- ============================================================================
-- PAAYO NEPAL — Initial PostgreSQL Schema Migration
-- ============================================================================
-- This migration creates the complete database schema.
-- Rust backend owns the schema. Frontend (Drizzle) introspects only.
-- ============================================================================

-- ============================================================================
-- CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE post_type AS ENUM ('article', 'event', 'activity', 'explore');
CREATE TYPE content_status AS ENUM ('draft', 'published');
CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'spam', 'rejected');
CREATE TYPE comment_target_type AS ENUM ('post', 'video', 'photo');
CREATE TYPE video_platform AS ENUM ('youtube', 'vimeo', 'tiktok');
CREATE TYPE hotel_price_range AS ENUM ('budget', 'mid', 'luxury');
CREATE TYPE tag_type AS ENUM ('activity', 'category', 'general');
CREATE TYPE content_tag_target AS ENUM ('post', 'video', 'photo', 'hotel');
CREATE TYPE hero_content_type AS ENUM ('post', 'video', 'photo', 'custom');
CREATE TYPE media_type AS ENUM ('image', 'document');
CREATE TYPE notification_type AS ENUM ('new_user', 'verified', 'content', 'comment', 'milestone');
CREATE TYPE content_link_source AS ENUM ('post', 'region');
CREATE TYPE content_link_target AS ENUM ('photo', 'video', 'post');
CREATE TYPE like_target_type AS ENUM ('post', 'video', 'photo');
CREATE TYPE view_target_type AS ENUM ('post', 'video', 'photo', 'hotel');

-- ============================================================================
-- AUTH TABLES (BetterAuth compatible)
-- ============================================================================

CREATE TABLE "user" (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    name VARCHAR(255),
    image TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'editor',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    banned_at TIMESTAMPTZ NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "session" (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "account" (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    access_token_expires_at TIMESTAMPTZ NULL,
    refresh_token_expires_at TIMESTAMPTZ NULL,
    scope TEXT,
    id_token TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "verification" (
    id VARCHAR(36) PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BetterAuth uses camelCase column names for these tables
CREATE TABLE "twoFactor" (
    id VARCHAR(36) PRIMARY KEY,
    "userId" VARCHAR(36) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    secret TEXT,
    "backupCodes" TEXT
);

CREATE TABLE "passkey" (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255),
    "publicKey" TEXT NOT NULL,
    "userId" VARCHAR(36) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "credentialID" TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    "deviceType" VARCHAR(50) NOT NULL,
    "backedUp" BOOLEAN NOT NULL DEFAULT FALSE,
    transports TEXT,
    aaguid VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REGIONS
-- ============================================================================

CREATE TABLE regions (
    id VARCHAR(36) PRIMARY KEY,
    author_id VARCHAR(36) NOT NULL REFERENCES "user"(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    cover_image VARCHAR(500),
    map_data JSONB,
    attraction_rank INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    status content_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_regions_slug ON regions(slug);
CREATE INDEX idx_regions_status ON regions(status);
CREATE INDEX idx_regions_rank ON regions(attraction_rank);

-- ============================================================================
-- POSTS (article, event, activity, explore — unified table)
-- ============================================================================

CREATE TABLE posts (
    id VARCHAR(36) PRIMARY KEY,
    type post_type NOT NULL DEFAULT 'article',
    author_id VARCHAR(36) NOT NULL REFERENCES "user"(id),
    region_id VARCHAR(36) REFERENCES regions(id),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    short_description TEXT,
    content JSONB,
    cover_image VARCHAR(500),
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ NULL,
    event_date TIMESTAMPTZ NULL,
    event_end_date TIMESTAMPTZ NULL,
    display_order INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    like_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_region ON posts(region_id);
CREATE INDEX idx_posts_published ON posts(published_at);
CREATE INDEX idx_posts_display_order ON posts(display_order);
CREATE INDEX idx_posts_type_status ON posts(type, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- PHOTO FEATURES (Gallery collections)
-- ============================================================================

CREATE TABLE photo_features (
    id VARCHAR(36) PRIMARY KEY,
    author_id VARCHAR(36) NOT NULL REFERENCES "user"(id),
    region_id VARCHAR(36) REFERENCES regions(id),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ NULL,
    display_order INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    like_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_photo_features_slug ON photo_features(slug);
CREATE INDEX idx_photo_features_author ON photo_features(author_id);
CREATE INDEX idx_photo_features_region ON photo_features(region_id);

CREATE TABLE photo_images (
    id VARCHAR(36) PRIMARY KEY,
    photo_feature_id VARCHAR(36) NOT NULL REFERENCES photo_features(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photo_images_feature ON photo_images(photo_feature_id);

-- ============================================================================
-- VIDEOS
-- ============================================================================

CREATE TABLE videos (
    id VARCHAR(36) PRIMARY KEY,
    author_id VARCHAR(36) NOT NULL REFERENCES "user"(id),
    region_id VARCHAR(36) REFERENCES regions(id),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    platform video_platform NOT NULL DEFAULT 'youtube',
    video_url VARCHAR(500) NOT NULL,
    video_id VARCHAR(100),
    thumbnail_url VARCHAR(500),
    duration INTEGER,
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ NULL,
    display_order INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    like_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_videos_slug ON videos(slug);
CREATE INDEX idx_videos_author ON videos(author_id);
CREATE INDEX idx_videos_region ON videos(region_id);
CREATE INDEX idx_videos_platform ON videos(platform);

-- ============================================================================
-- HOTELS (no likes, no comments per decision)
-- ============================================================================

CREATE TABLE hotels (
    id VARCHAR(36) PRIMARY KEY,
    author_id VARCHAR(36) NOT NULL REFERENCES "user"(id),
    region_id VARCHAR(36) REFERENCES regions(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(500),
    star_rating SMALLINT,
    price_range hotel_price_range,
    amenities JSONB,
    cover_image VARCHAR(500),
    gallery JSONB,
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ NULL,
    display_order INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_hotels_slug ON hotels(slug);
CREATE INDEX idx_hotels_author ON hotels(author_id);
CREATE INDEX idx_hotels_region ON hotels(region_id);

CREATE TABLE hotel_branches (
    id VARCHAR(36) PRIMARY KEY,
    hotel_id VARCHAR(36) NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    coordinates JSONB,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hotel_branches_hotel ON hotel_branches(hotel_id);

-- ============================================================================
-- COMMENTS (guest commenting with moderation)
-- Hotels excluded per decision
-- ============================================================================

CREATE TABLE comments (
    id VARCHAR(36) PRIMARY KEY,
    parent_id VARCHAR(36),
    target_type comment_target_type NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    guest_name VARCHAR(100) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status comment_status NOT NULL DEFAULT 'pending',
    ip_address VARCHAR(45),
    viewer_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_approved ON comments(target_type, target_id, status) WHERE status = 'approved';

-- ============================================================================
-- CONTENT LIKES (deduplicated via viewer_hash)
-- Hotels excluded per decision
-- ============================================================================

CREATE TABLE content_likes (
    id VARCHAR(36) PRIMARY KEY,
    target_type like_target_type NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    viewer_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(target_type, target_id, viewer_hash)
);

CREATE INDEX idx_content_likes_target ON content_likes(target_type, target_id);

-- ============================================================================
-- VIEW TRACKING
-- ============================================================================

CREATE TABLE content_views (
    id VARCHAR(36) PRIMARY KEY,
    target_type view_target_type NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    viewer_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    referrer VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_views_target ON content_views(target_type, target_id);
CREATE INDEX idx_content_views_created ON content_views(created_at);
CREATE INDEX idx_content_views_dedup ON content_views(target_type, target_id, viewer_hash, created_at);

-- Daily aggregated view counts
CREATE TABLE view_aggregates (
    id VARCHAR(36) PRIMARY KEY,
    target_type view_target_type NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    view_date DATE NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    unique_viewers INTEGER NOT NULL DEFAULT 0,
    UNIQUE(target_type, target_id, view_date)
);

CREATE INDEX idx_view_aggregates_target ON view_aggregates(target_type, target_id);
CREATE INDEX idx_view_aggregates_date ON view_aggregates(view_date);

-- ============================================================================
-- CONTENT LINKS (linking content together)
-- ============================================================================

CREATE TABLE content_links (
    id VARCHAR(36) PRIMARY KEY,
    source_type content_link_source NOT NULL,
    source_id VARCHAR(36) NOT NULL,
    target_type content_link_target NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_links_source ON content_links(source_type, source_id);
CREATE INDEX idx_content_links_target ON content_links(target_type, target_id);

-- ============================================================================
-- TAGS
-- ============================================================================

CREATE TABLE tags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    tag_type tag_type NOT NULL DEFAULT 'general',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_type ON tags(tag_type);

CREATE TABLE content_tags (
    id VARCHAR(36) PRIMARY KEY,
    tag_id VARCHAR(36) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    target_type content_tag_target NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    UNIQUE(tag_id, target_type, target_id)
);

CREATE INDEX idx_content_tags_tag ON content_tags(tag_id);
CREATE INDEX idx_content_tags_target ON content_tags(target_type, target_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    recipient_id VARCHAR(36) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    actor_id VARCHAR(36) REFERENCES "user"(id) ON DELETE SET NULL,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    target_type VARCHAR(50),
    target_id VARCHAR(36),
    action_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read) WHERE is_read = FALSE;

-- ============================================================================
-- HERO SLIDES
-- ============================================================================

CREATE TABLE hero_slides (
    id VARCHAR(36) PRIMARY KEY,
    content_type hero_content_type NOT NULL,
    content_id VARCHAR(36),
    custom_title VARCHAR(500),
    custom_description TEXT,
    custom_image VARCHAR(500),
    custom_link VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hero_slides_order ON hero_slides(sort_order);
CREATE INDEX idx_hero_slides_active ON hero_slides(is_active);

-- ============================================================================
-- MEDIA (General media storage)
-- ============================================================================

CREATE TABLE media (
    id VARCHAR(36) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    type media_type NOT NULL DEFAULT 'image',
    width INTEGER,
    height INTEGER,
    blur_hash VARCHAR(100),
    thumbnail_path VARCHAR(255),
    alt VARCHAR(255),
    caption TEXT,
    uploaded_by VARCHAR(36) NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_uploader ON media(uploaded_by);

-- ============================================================================
-- TRIGGER: auto-update updated_at columns
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have the column
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "session"
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "account"
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON regions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON photo_features
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON hotels
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON hotel_branches
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON hero_slides
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- FULL TEXT SEARCH INDEXES (PostgreSQL tsvector)
-- ============================================================================

-- Posts full-text search
CREATE INDEX idx_posts_fulltext ON posts
    USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, '')));

-- Regions full-text search
CREATE INDEX idx_regions_fulltext ON regions
    USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Videos full-text search
CREATE INDEX idx_videos_fulltext ON videos
    USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Hotels full-text search
CREATE INDEX idx_hotels_fulltext ON hotels
    USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));
