import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// Matches: CREATE TYPE hero_content_type AS ENUM ('post', 'video', 'photo', 'custom');
export const heroContentType = pgEnum("hero_content_type", [
  "post",
  "video",
  "photo",
  "custom",
]);

// Mirrors: tour_backend/migrations/20250101000000_initial_schema.sql → hero_slides
export const heroSlides = pgTable(
  "hero_slides",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    contentType: heroContentType("content_type").notNull(),
    contentId: varchar("content_id", { length: 36 }),
    customTitle: varchar("custom_title", { length: 500 }),
    customDescription: text("custom_description"),
    customImage: varchar("custom_image", { length: 500 }),
    customLink: varchar("custom_link", { length: 500 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").default(true).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orderIdx: index("idx_hero_slides_order").on(table.sortOrder),
    activeIdx: index("idx_hero_slides_active").on(table.isActive),
  }),
);

// Type exports
export type HeroSlide = typeof heroSlides.$inferSelect;
export type NewHeroSlide = typeof heroSlides.$inferInsert;
