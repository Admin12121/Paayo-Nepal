import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  boolean,
  index,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { media } from "./media";

export const activities = mysqlTable(
  "activities",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    content: text("content"), // Rich content for activity detail page
    featuredImage: varchar("featured_image", { length: 255 }),
    featuredImageBlur: varchar("featured_image_blur", { length: 100 }),
    heroImage: varchar("hero_image", { length: 255 }), // For hero section
    icon: varchar("icon", { length: 100 }), // Icon identifier
    displayOrder: int("display_order").default(0),
    isActive: boolean("is_active").default(true),
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("activity_slug_idx").on(table.slug),
    orderIdx: index("activity_order_idx").on(table.displayOrder),
    activeIdx: index("active_idx").on(table.isActive),
  })
);

// Gallery for each activity
export const activityGallery = mysqlTable(
  "activity_gallery",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    activityId: varchar("activity_id", { length: 36 })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    mediaId: varchar("media_id", { length: 36 })
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    displayOrder: int("display_order").default(0),
  },
  (table) => ({
    activityIdx: index("gallery_activity_idx").on(table.activityId),
    orderIdx: index("gallery_order_idx").on(table.displayOrder),
  })
);

// Type exports
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ActivityGalleryItem = typeof activityGallery.$inferSelect;

// Activity types commonly offered in Nepal tourism
export const ActivityTypes = {
  TREKKING: "trekking",
  HIKING: "hiking",
  MOUNTAINEERING: "mountaineering",
  RAFTING: "rafting",
  PARAGLIDING: "paragliding",
  BUNGEE_JUMPING: "bungee-jumping",
  WILDLIFE_SAFARI: "wildlife-safari",
  CULTURAL_TOURS: "cultural-tours",
  PHOTOGRAPHY: "photography",
  YOGA_MEDITATION: "yoga-meditation",
  BIRD_WATCHING: "bird-watching",
  CYCLING: "cycling",
} as const;
