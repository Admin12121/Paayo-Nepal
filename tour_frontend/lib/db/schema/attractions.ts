import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  boolean,
  json,
  index,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { regions } from "./regions";
import { activities } from "./activities";

export const attractions = mysqlTable(
  "attractions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    content: text("content"),
    featuredImage: varchar("featured_image", { length: 255 }),
    featuredImageBlur: varchar("featured_image_blur", { length: 100 }),
    regionId: varchar("region_id", { length: 36 }).references(() => regions.id),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    address: varchar("address", { length: 500 }),
    openingHours: json("opening_hours").$type<{
      [day: string]: { open: string; close: string };
    }>(),
    entryFee: varchar("entry_fee", { length: 100 }),
    isTopAttraction: boolean("is_top_attraction").default(false),
    views: int("views").default(0),
    rating: decimal("rating", { precision: 2, scale: 1 }),
    reviewCount: int("review_count").default(0),
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("attraction_slug_idx").on(table.slug),
    regionIdx: index("attraction_region_idx").on(table.regionId),
    topIdx: index("top_idx").on(table.isTopAttraction),
    viewsIdx: index("views_idx").on(table.views),
  })
);

// Many-to-many: Attractions can have multiple activities
export const attractionActivities = mysqlTable(
  "attraction_activities",
  {
    attractionId: varchar("attraction_id", { length: 36 })
      .notNull()
      .references(() => attractions.id, { onDelete: "cascade" }),
    activityId: varchar("activity_id", { length: 36 })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.attractionId, table.activityId] }),
  })
);

// Type exports
export type Attraction = typeof attractions.$inferSelect;
export type NewAttraction = typeof attractions.$inferInsert;
export type AttractionActivity = typeof attractionActivities.$inferSelect;

// Type with region info
export interface AttractionWithRegion extends Attraction {
  region?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}
