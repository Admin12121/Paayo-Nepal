import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  smallint,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { regions } from "./regions";

// Matches: CREATE TYPE hotel_price_range AS ENUM ('budget', 'mid', 'luxury');
export const hotelPriceRange = pgEnum("hotel_price_range", [
  "budget",
  "mid",
  "luxury",
]);

// content_status enum is declared in regions.ts — import from there to avoid circular deps
import { contentStatus } from "./regions";

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → hotels
export const hotels = pgTable(
  "hotels",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    authorId: varchar("author_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    regionId: varchar("region_id", { length: 36 }).references(() => regions.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    website: varchar("website", { length: 500 }),
    starRating: smallint("star_rating"),
    priceRange: hotelPriceRange("price_range"),
    amenities: jsonb("amenities"),
    coverImage: varchar("cover_image", { length: 500 }),
    gallery: jsonb("gallery"),
    status: contentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    displayOrder: integer("display_order"),
    isFeatured: boolean("is_featured").default(false).notNull(),
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
    slugIdx: index("idx_hotels_slug").on(table.slug),
    authorIdx: index("idx_hotels_author").on(table.authorId),
    regionIdx: index("idx_hotels_region").on(table.regionId),
  }),
);

// Mirrors: tour_backend/migrations → hotel_branches
export const hotelBranches = pgTable(
  "hotel_branches",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    hotelId: varchar("hotel_id", { length: 36 })
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    coordinates: jsonb("coordinates"),
    isMain: boolean("is_main").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    hotelIdx: index("idx_hotel_branches_hotel").on(table.hotelId),
  }),
);

// Type exports
export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;
export type HotelBranch = typeof hotelBranches.$inferSelect;
export type NewHotelBranch = typeof hotelBranches.$inferInsert;

export interface HotelWithBranches extends Hotel {
  branches: HotelBranch[];
}
