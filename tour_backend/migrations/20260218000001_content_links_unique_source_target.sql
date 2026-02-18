-- Ensure each source item can only link once to a given target.
-- If duplicate rows were inserted previously, keep the earliest row and
-- remove later duplicates before adding the uniqueness constraint.

WITH ranked_links AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY source_type, source_id, target_type, target_id
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM content_links
)
DELETE FROM content_links
WHERE id IN (
    SELECT id
    FROM ranked_links
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_links_unique_source_target
    ON content_links(source_type, source_id, target_type, target_id);
