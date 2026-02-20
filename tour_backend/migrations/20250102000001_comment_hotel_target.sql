-- ============================================================================
-- Add 'hotel' to comment_target_type enum
-- ============================================================================
-- Previously the enum only had: 'post', 'video', 'photo'
-- Hotels can now receive comments too.
-- ============================================================================

ALTER TYPE comment_target_type ADD VALUE IF NOT EXISTS 'hotel';
