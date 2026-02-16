import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// Matches: CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'spam', 'rejected');
export const commentStatusEnum = pgEnum("comment_status", [
  "pending",
  "approved",
  "spam",
  "rejected",
]);

// Matches: CREATE TYPE comment_target_type AS ENUM ('post', 'video', 'photo');
export const commentTargetTypeEnum = pgEnum("comment_target_type", [
  "post",
  "video",
  "photo",
]);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql — comments table
export const comments = pgTable(
  "comments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    parentId: varchar("parent_id", { length: 36 }),
    targetType: commentTargetTypeEnum("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    guestName: varchar("guest_name", { length: 100 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }).notNull(),
    content: text("content").notNull(),
    status: commentStatusEnum("status").default("pending").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    viewerHash: varchar("viewer_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    targetIdx: index("idx_comments_target").on(
      table.targetType,
      table.targetId,
    ),
    parentIdx: index("idx_comments_parent").on(table.parentId),
    statusIdx: index("idx_comments_status").on(table.status),
  }),
);

// Type exports
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

// Type with nested replies for display
export interface CommentWithReplies extends Comment {
  replies?: CommentWithReplies[];
}

export const CommentTargetTypes = {
  POST: "post",
  VIDEO: "video",
  PHOTO: "photo",
} as const;

export const CommentStatuses = {
  PENDING: "pending",
  APPROVED: "approved",
  SPAM: "spam",
  REJECTED: "rejected",
} as const;
