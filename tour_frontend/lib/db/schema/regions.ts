import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Mirrors: CREATE TYPE content_status AS ENUM ('draft', 'published');
// Declared here (regions has no schema imports) to avoid circular deps.
// Other schemas (posts, videos, hotels, photo-features) import from here.
export const contentStatus = pgEnum("content_status", ["draft", "published"]);

export const regions = pgTable(
  "regions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    authorId: varchar("author_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    coverImage: varchar("cover_image", { length: 500 }),
    mapData: jsonb("map_data"),
    attractionRank: integer("attraction_rank"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    status: contentStatus("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    slugIdx: index("idx_regions_slug").on(table.slug),
    statusIdx: index("idx_regions_status").on(table.status),
    rankIdx: index("idx_regions_rank").on(table.attractionRank),
  }),
);

// Type exports
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;

// Nepal provinces
export const NepalProvinces = {
  KOSHI: "Koshi",
  MADHESH: "Madhesh",
  BAGMATI: "Bagmati",
  GANDAKI: "Gandaki",
  LUMBINI: "Lumbini",
  KARNALI: "Karnali",
  SUDURPASHCHIM: "Sudurpashchim",
} as const;
