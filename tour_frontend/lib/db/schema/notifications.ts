import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Matches: CREATE TYPE notification_type AS ENUM (...)
export const notificationType = pgEnum("notification_type", [
  "new_user",
  "verified",
  "content",
  "comment",
  "milestone",
]);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → notifications
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    recipientId: varchar("recipient_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id", { length: 36 }).references(() => user.id, {
      onDelete: "set null",
    }),
    type: notificationType("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    targetType: varchar("target_type", { length: 50 }),
    targetId: varchar("target_id", { length: 36 }),
    actionUrl: varchar("action_url", { length: 500 }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    recipientIdx: index("idx_notifications_recipient").on(table.recipientId),
    readIdx: index("idx_notifications_read").on(table.isRead),
    typeIdx: index("idx_notifications_type").on(table.type),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
