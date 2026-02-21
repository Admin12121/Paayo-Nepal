-- Better Auth v1.4.x expects `updatedAt` field in verification schema.
-- Add DB column to match frontend Drizzle schema (`updated_at`).
ALTER TABLE "verification"
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
