import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const mediaType = pgEnum("media_type", ["image", "document"]);

export const media = pgTable(
  "media",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer("size").notNull(), // bytes
    type: mediaType("type").default("image").notNull(),
    width: integer("width"),
    height: integer("height"),
    blurHash: varchar("blur_hash", { length: 100 }), // For image placeholders
    thumbnailPath: varchar("thumbnail_path", { length: 255 }),
    alt: varchar("alt", { length: 255 }),
    caption: text("caption"),
    uploadedBy: varchar("uploaded_by", { length: 36 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    typeIdx: index("idx_media_type").on(table.type),
    uploaderIdx: index("idx_media_uploader").on(table.uploadedBy),
  }),
);

// Type exports
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

export const MediaTypes = {
  IMAGE: "image",
  DOCUMENT: "document",
} as const;
