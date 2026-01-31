import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  index,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";
import { posts } from "./posts";

export const comments = mysqlTable(
  "comments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    postId: varchar("post_id", { length: 36 })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    parentId: varchar("parent_id", { length: 36 }), // For nested replies
    content: text("content").notNull(),
    likes: int("likes").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    postIdx: index("post_idx").on(table.postId),
    userIdx: index("user_idx").on(table.userId),
    parentIdx: index("parent_idx").on(table.parentId),
  })
);

export const commentLikes = mysqlTable(
  "comment_likes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    commentId: varchar("comment_id", { length: 36 })
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueLike: index("unique_comment_like").on(table.commentId, table.userId),
  })
);

// Type exports
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type CommentLike = typeof commentLikes.$inferSelect;

// Type with user info for display
export interface CommentWithUser extends Comment {
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  replies?: CommentWithUser[];
}
