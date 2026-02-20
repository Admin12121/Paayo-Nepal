-- Add optional region selection per hotel branch.
-- Branches can now belong to a different region than the parent hotel.

ALTER TABLE hotel_branches
ADD COLUMN IF NOT EXISTS region_id VARCHAR(36) REFERENCES regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_branches_region ON hotel_branches(region_id);
