import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  date,
  time,
  boolean,
  int,
  json,
  index,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";

export const events = mysqlTable(
  "events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    content: text("content"),
    featuredImage: varchar("featured_image", { length: 255 }),
    featuredImageBlur: varchar("featured_image_blur", { length: 100 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    location: varchar("location", { length: 255 }),
    regionId: varchar("region_id", { length: 36 }),
    isRecurring: boolean("is_recurring").default(false),
    recurringPattern: json("recurring_pattern").$type<{
      type: string;
      interval: number;
    }>(),
    isFeatured: boolean("is_featured").default(false),
    views: int("views").default(0),
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("event_slug_idx").on(table.slug),
    dateIdx: index("date_idx").on(table.startDate),
    regionIdx: index("event_region_idx").on(table.regionId),
    featuredIdx: index("featured_idx").on(table.isFeatured),
  })
);

// Type exports
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
