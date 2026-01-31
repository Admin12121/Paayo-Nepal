import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  json,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";

export const postStatus = mysqlEnum("post_status", [
  "draft",
  "pending",
  "published",
  "archived",
]);

export const postType = mysqlEnum("post_type", ["blog", "article", "news"]);

export const posts = mysqlTable(
  "posts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 500 }).notNull(),
    excerpt: text("excerpt"),
    content: text("content").notNull(),
    featuredImage: varchar("featured_image", { length: 255 }),
    featuredImageBlur: varchar("featured_image_blur", { length: 100 }), // BlurHash
    type: postType.default("blog").notNull(),
    status: postStatus.default("draft").notNull(),
    authorId: varchar("author_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    approvedBy: varchar("approved_by", { length: 36 }).references(() => user.id),
    approvedAt: timestamp("approved_at"),
    publishedAt: timestamp("published_at"),
    views: int("views").default(0).notNull(),
    likes: int("likes").default(0).notNull(),
    metaTitle: varchar("meta_title", { length: 255 }),
    metaDescription: text("meta_description"),
    tags: json("tags").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("slug_idx").on(table.slug),
    statusIdx: index("status_idx").on(table.status),
    authorIdx: index("author_idx").on(table.authorId),
    publishedIdx: index("published_idx").on(table.publishedAt),
    typeIdx: index("type_idx").on(table.type),
  })
);

export const postLikes = mysqlTable(
  "post_likes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    postId: varchar("post_id", { length: 36 })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueLike: index("unique_like").on(table.postId, table.userId),
  })
);

// Type exports
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;

export const PostStatuses = {
  DRAFT: "draft",
  PENDING: "pending",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export const PostTypes = {
  BLOG: "blog",
  ARTICLE: "article",
  NEWS: "news",
} as const;
