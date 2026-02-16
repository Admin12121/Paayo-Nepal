import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { regions } from "./regions";
import { contentStatus } from "./regions";

// Matches: CREATE TYPE video_platform AS ENUM ('youtube', 'vimeo', 'tiktok');
export const videoPlatform = pgEnum("video_platform", [
  "youtube",
  "vimeo",
  "tiktok",
]);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → videos
export const videos = pgTable(
  "videos",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    authorId: varchar("author_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    regionId: varchar("region_id", { length: 36 }).references(() => regions.id),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    platform: videoPlatform("platform").default("youtube").notNull(),
    videoUrl: varchar("video_url", { length: 500 }).notNull(),
    videoId: varchar("video_id", { length: 100 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
    duration: integer("duration"), // Duration in seconds
    status: contentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    displayOrder: integer("display_order"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    slugIdx: index("idx_videos_slug").on(table.slug),
    authorIdx: index("idx_videos_author").on(table.authorId),
    regionIdx: index("idx_videos_region").on(table.regionId),
    platformIdx: index("idx_videos_platform").on(table.platform),
  }),
);

// Type exports
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
