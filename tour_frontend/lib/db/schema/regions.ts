import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  index,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";

export const regions = mysqlTable(
  "regions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    featuredImage: varchar("featured_image", { length: 255 }),
    featuredImageBlur: varchar("featured_image_blur", { length: 100 }),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    province: varchar("province", { length: 100 }),
    district: varchar("district", { length: 100 }),
    displayOrder: int("display_order").default(0),
    createdBy: varchar("created_by", { length: 36 })
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("region_slug_idx").on(table.slug),
    orderIdx: index("order_idx").on(table.displayOrder),
    provinceIdx: index("province_idx").on(table.province),
  })
);

// Type exports
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;

// Nepal provinces
export const NepalProvinces = {
  KOSHI: "Koshi",
  MADHESH: "Madhesh",
  BAGMATI: "Bagmati",
  GANDAKI: "Gandaki",
  LUMBINI: "Lumbini",
  KARNALI: "Karnali",
  SUDURPASHCHIM: "Sudurpashchim",
} as const;
