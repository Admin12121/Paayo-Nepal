-- ============================================================================
-- Add geographic detail columns to regions
-- ============================================================================
-- The frontend pages expect province, district, latitude, and longitude
-- as top-level fields on Region objects. These are core geographic attributes
-- that belong as real columns rather than buried in map_data JSONB.
-- ============================================================================

ALTER TABLE regions
    ADD COLUMN province VARCHAR(255),
    ADD COLUMN district VARCHAR(255),
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION;

CREATE INDEX idx_regions_province ON regions(province) WHERE province IS NOT NULL;
CREATE INDEX idx_regions_district ON regions(district) WHERE district IS NOT NULL;
