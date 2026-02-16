-- ============================================================================
-- Migration: Soft Delete + Unique Slug (Partial Unique Indexes)
-- ============================================================================
-- Replace plain UNIQUE constraints on slug columns with partial unique indexes
-- that only enforce uniqueness among non-deleted rows.
-- This allows a soft-deleted row to "release" its slug so a new row can reuse it.
-- PostgreSQL supports this natively via WHERE clause on unique indexes.
-- ============================================================================

-- ============================================================================
-- REGIONS: Drop existing unique constraint, add partial unique index
-- ============================================================================

-- The inline UNIQUE on regions.slug created a constraint named "regions_slug_key"
ALTER TABLE regions DROP CONSTRAINT IF EXISTS regions_slug_key;
-- Also drop the plain index if it exists
DROP INDEX IF EXISTS idx_regions_slug;

CREATE UNIQUE INDEX idx_regions_slug_active
    ON regions(slug)
    WHERE deleted_at IS NULL;

-- Keep a non-unique index on slug for lookups on deleted rows (admin trash view)
CREATE INDEX IF NOT EXISTS idx_regions_slug_all ON regions(slug);

-- ============================================================================
-- POSTS: Drop existing unique constraint, add partial unique index
-- ============================================================================

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_slug_key;
DROP INDEX IF EXISTS idx_posts_slug;

CREATE UNIQUE INDEX idx_posts_slug_active
    ON posts(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_slug_all ON posts(slug);

-- ============================================================================
-- PHOTO_FEATURES: Drop existing unique constraint, add partial unique index
-- ============================================================================

ALTER TABLE photo_features DROP CONSTRAINT IF EXISTS photo_features_slug_key;
DROP INDEX IF EXISTS idx_photo_features_slug;

CREATE UNIQUE INDEX idx_photo_features_slug_active
    ON photo_features(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photo_features_slug_all ON photo_features(slug);

-- ============================================================================
-- VIDEOS: Drop existing unique constraint, add partial unique index
-- ============================================================================

ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_slug_key;
DROP INDEX IF EXISTS idx_videos_slug;

CREATE UNIQUE INDEX idx_videos_slug_active
    ON videos(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_slug_all ON videos(slug);

-- ============================================================================
-- HOTELS: Drop existing unique constraint, add partial unique index
-- ============================================================================

ALTER TABLE hotels DROP CONSTRAINT IF EXISTS hotels_slug_key;
DROP INDEX IF EXISTS idx_hotels_slug;

CREATE UNIQUE INDEX idx_hotels_slug_active
    ON hotels(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotels_slug_all ON hotels(slug);

-- ============================================================================
-- TAGS: tags don't have soft delete, so keep the plain UNIQUE constraint.
-- No changes needed for tags.slug or tags.name.
-- ============================================================================
