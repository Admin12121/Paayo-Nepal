import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  boolean,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";

export const mediaType = mysqlEnum("media_type", [
  "image",
  "video_link",
  "document",
]);

export const media = mysqlTable(
  "media",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: int("size").notNull(), // bytes
    type: mediaType.default("image").notNull(),
    width: int("width"),
    height: int("height"),
    blurHash: varchar("blur_hash", { length: 100 }), // For image placeholders
    thumbnailPath: varchar("thumbnail_path", { length: 255 }),
    alt: varchar("alt", { length: 255 }),
    caption: text("caption"),
    uploadedBy: varchar("uploaded_by", { length: 36 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("type_idx").on(table.type),
    uploaderIdx: index("uploader_idx").on(table.uploadedBy),
  })
);

// For video links (YouTube, Vimeo, etc.)
export const videoLinks = mysqlTable("video_links", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  platform: varchar("platform", { length: 50 }), // youtube, vimeo, etc.
  duration: varchar("duration", { length: 20 }),
  views: int("views").default(0),
  featured: boolean("featured").default(false),
  uploadedBy: varchar("uploaded_by", { length: 36 })
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type VideoLink = typeof videoLinks.$inferSelect;
export type NewVideoLink = typeof videoLinks.$inferInsert;

export const MediaTypes = {
  IMAGE: "image",
  VIDEO_LINK: "video_link",
  DOCUMENT: "document",
} as const;
