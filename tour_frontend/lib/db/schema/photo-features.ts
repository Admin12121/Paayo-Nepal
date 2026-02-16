import {
  pgTable,
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

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → photo_features
export const photoFeatures = pgTable(
  "photo_features",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    authorId: varchar("author_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    regionId: varchar("region_id", { length: 36 }).references(() => regions.id),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
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
    slugIdx: index("idx_photo_features_slug").on(table.slug),
    authorIdx: index("idx_photo_features_author").on(table.authorId),
    regionIdx: index("idx_photo_features_region").on(table.regionId),
  }),
);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → photo_images
export const photoImages = pgTable(
  "photo_images",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    photoFeatureId: varchar("photo_feature_id", { length: 36 })
      .notNull()
      .references(() => photoFeatures.id, { onDelete: "cascade" }),
    imageUrl: varchar("image_url", { length: 500 }).notNull(),
    caption: text("caption"),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    featureIdx: index("idx_photo_images_feature").on(table.photoFeatureId),
  }),
);

// Type exports
export type PhotoFeature = typeof photoFeatures.$inferSelect;
export type NewPhotoFeature = typeof photoFeatures.$inferInsert;
export type PhotoImage = typeof photoImages.$inferSelect;
export type NewPhotoImage = typeof photoImages.$inferInsert;

export interface PhotoFeatureWithImages extends PhotoFeature {
  images: PhotoImage[];
}
