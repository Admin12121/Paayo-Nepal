import type { Config } from "drizzle-kit";

/**
 * Drizzle Configuration for Schema Introspection
 *
 * IMPORTANT: Rust backend OWNS the database schema.
 *
 * This config is ONLY for:
 * - `bun db:pull` - introspect existing tables (READ ONLY)
 * - `bun db:studio` - database GUI
 *
 * DO NOT USE:
 * - `db:push` - would overwrite Rust schema
 * - `db:generate` - would create migrations
 *
 * The Rust backend manages all migrations via SQLx.
 * We maintain TypeScript schema files in lib/db/schema/ manually
 * to mirror the PostgreSQL tables for type safety and querying.
 */

export default {
  schema: "./lib/db/schema/*",
  out: "./lib/db/introspected",
  dialect: "postgresql",
  // Introspect-only config (pull = read from DB)
  introspect: {
    casing: "camel",
  },
  dbCredentials: {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432"),
    user: process.env.DATABASE_USER || "tourism",
    password: process.env.DATABASE_PASSWORD || "tourism_dev_password",
    database: process.env.DATABASE_NAME || "tourism",
    ssl: false,
  },
} satisfies Config;
