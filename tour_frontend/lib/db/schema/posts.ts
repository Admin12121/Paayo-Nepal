import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { regions, contentStatus } from "./regions";

// Mirrors: CREATE TYPE post_type AS ENUM ('article', 'event', 'activity', 'explore');
export const postType = pgEnum("post_type", [
  "article",
  "event",
  "activity",
  "explore",
]);

export const posts = pgTable(
  "posts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    type: postType("type").default("article").notNull(),
    authorId: varchar("author_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    regionId: varchar("region_id", { length: 36 }).references(() => regions.id),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    shortDescription: text("short_description"),
    content: jsonb("content"),
    coverImage: varchar("cover_image", { length: 500 }),
    status: contentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    eventDate: timestamp("event_date", { withTimezone: true }),
    eventEndDate: timestamp("event_end_date", { withTimezone: true }),
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
    slugIdx: index("idx_posts_slug").on(table.slug),
    statusIdx: index("idx_posts_status").on(table.status),
    typeIdx: index("idx_posts_type").on(table.type),
    authorIdx: index("idx_posts_author").on(table.authorId),
    regionIdx: index("idx_posts_region").on(table.regionId),
    publishedIdx: index("idx_posts_published").on(table.publishedAt),
    orderIdx: index("idx_posts_display_order").on(table.displayOrder),
  }),
);

// Type exports
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export const PostStatuses = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export const PostTypes = {
  ARTICLE: "article",
  EVENT: "event",
  ACTIVITY: "activity",
  EXPLORE: "explore",
} as const;
