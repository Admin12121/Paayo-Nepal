// Central schema export - Single source of truth for database structure
// Rust backend owns migrations (SQLx/PostgreSQL). Drizzle mirrors for TypeScript types.
// Schema must match tour_backend/migrations/20250101000000_initial_schema.sql

// Auth & Users (BetterAuth managed)
export * from "./auth";
export * from "./users";

// Core content
export * from "./posts"; // Unified: article, event, activity, explore
export * from "./regions";
export * from "./comments";

// Media & Features
export * from "./media";
export * from "./photo-features";
export * from "./videos";

// Business
export * from "./hotels";

// Organization
export * from "./tags";
export * from "./content-links";

// UI Components
export * from "./hero-slides";

// Notifications
export * from "./notifications";
