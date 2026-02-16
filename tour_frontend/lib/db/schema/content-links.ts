import {
  pgTable,
  pgEnum,
  varchar,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// Matches: CREATE TYPE content_link_source AS ENUM ('post', 'region');
export const contentLinkSource = pgEnum("content_link_source", [
  "post",
  "region",
]);

// Matches: CREATE TYPE content_link_target AS ENUM ('photo', 'video', 'post');
export const contentLinkTarget = pgEnum("content_link_target", [
  "photo",
  "video",
  "post",
]);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → content_links
export const contentLinks = pgTable(
  "content_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sourceType: contentLinkSource("source_type").notNull(),
    sourceId: varchar("source_id", { length: 36 }).notNull(),
    targetType: contentLinkTarget("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceIdx: index("idx_content_links_source").on(
      table.sourceType,
      table.sourceId,
    ),
    targetIdx: index("idx_content_links_target").on(
      table.targetType,
      table.targetId,
    ),
  }),
);

// Type exports
export type ContentLink = typeof contentLinks.$inferSelect;
export type NewContentLink = typeof contentLinks.$inferInsert;
