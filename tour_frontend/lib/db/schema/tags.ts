import {
  pgTable,
  pgEnum,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Matches: CREATE TYPE tag_type AS ENUM ('activity', 'category', 'general');
export const tagTypeEnum = pgEnum("tag_type", [
  "activity",
  "category",
  "general",
]);

// Matches: CREATE TYPE content_tag_target AS ENUM ('post', 'video', 'photo', 'hotel');
export const contentTagTargetEnum = pgEnum("content_tag_target", [
  "post",
  "video",
  "photo",
  "hotel",
]);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → tags
export const tags = pgTable(
  "tags",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    tagType: tagTypeEnum("tag_type").default("general").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIdx: index("idx_tags_slug").on(table.slug),
    typeIdx: index("idx_tags_type").on(table.tagType),
  }),
);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → content_tags
export const contentTags = pgTable(
  "content_tags",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tagId: varchar("tag_id", { length: 36 })
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    targetType: contentTagTargetEnum("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
  },
  (table) => ({
    tagIdx: index("idx_content_tags_tag").on(table.tagId),
    targetIdx: index("idx_content_tags_target").on(
      table.targetType,
      table.targetId,
    ),
    uniqueTagContent: uniqueIndex(
      "content_tags_tag_id_target_type_target_id_key",
    ).on(table.tagId, table.targetType, table.targetId),
  }),
);

// Type exports
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ContentTag = typeof contentTags.$inferSelect;
export type NewContentTag = typeof contentTags.$inferInsert;

// Taggable content types
export const TaggableContentTypes = {
  POST: "post",
  VIDEO: "video",
  PHOTO: "photo",
  HOTEL: "hotel",
} as const;

export const TagTypes = {
  ACTIVITY: "activity",
  CATEGORY: "category",
  GENERAL: "general",
} as const;
