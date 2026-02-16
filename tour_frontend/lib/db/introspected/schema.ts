import {
  pgTable,
  bigint,
  text,
  timestamp,
  boolean,
  unique,
  varchar,
  foreignKey,
  integer,
  index,
  uniqueIndex,
  jsonb,
  doublePrecision,
  smallint,
  date,
  pgEnum,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const commentStatus = pgEnum("comment_status", [
  "pending",
  "approved",
  "spam",
  "rejected",
]);
export const commentTargetType = pgEnum("comment_target_type", [
  "post",
  "video",
  "photo",
  "hotel",
]);
export const contentLinkSource = pgEnum("content_link_source", [
  "post",
  "region",
]);
export const contentLinkTarget = pgEnum("content_link_target", [
  "photo",
  "video",
  "post",
]);
export const contentStatus = pgEnum("content_status", ["draft", "published"]);
export const contentTagTarget = pgEnum("content_tag_target", [
  "post",
  "video",
  "photo",
  "hotel",
]);
export const heroContentType = pgEnum("hero_content_type", [
  "post",
  "video",
  "photo",
  "custom",
]);
export const hotelPriceRange = pgEnum("hotel_price_range", [
  "budget",
  "mid",
  "luxury",
]);
export const likeTargetType = pgEnum("like_target_type", [
  "post",
  "video",
  "photo",
]);
export const mediaType = pgEnum("media_type", ["image", "document"]);
export const notificationType = pgEnum("notification_type", [
  "new_user",
  "verified",
  "content",
  "comment",
  "milestone",
]);
export const postType = pgEnum("post_type", [
  "article",
  "event",
  "activity",
  "explore",
]);
export const tagType = pgEnum("tag_type", ["activity", "category", "general"]);
export const videoPlatform = pgEnum("video_platform", [
  "youtube",
  "vimeo",
  "tiktok",
]);
export const viewTargetType = pgEnum("view_target_type", [
  "post",
  "video",
  "photo",
  "hotel",
]);

export const sqlxMigrations = pgTable("_sqlx_migrations", {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  version: bigint({ mode: "number" }).primaryKey().notNull(),
  description: text().notNull(),
  installedOn: timestamp("installed_on", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  success: boolean().notNull(),
  checksum: bytea("checksum").notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  executionTime: bigint("execution_time", { mode: "number" }).notNull(),
});

export const user = pgTable(
  "user",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    email: varchar({ length: 255 }).notNull(),
    emailVerified: boolean("email_verified").default(false),
    name: varchar({ length: 255 }),
    image: text(),
    role: varchar({ length: 20 }).default("editor").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    bannedAt: timestamp("banned_at", { withTimezone: true, mode: "string" }),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("user_email_key").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    token: varchar({ length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_fkey",
    }).onDelete("cascade"),
    unique("session_token_key").on(table.token),
  ],
);

export const account = pgTable(
  "account",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    scope: text(),
    idToken: text("id_token"),
    password: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_user_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const verification = pgTable("verification", {
  id: varchar({ length: 36 }).primaryKey().notNull(),
  identifier: varchar({ length: 255 }).notNull(),
  value: varchar({ length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
});

export const twoFactor = pgTable(
  "twoFactor",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    userId: varchar({ length: 36 }).notNull(),
    secret: text(),
    backupCodes: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "twoFactor_userId_fkey",
    }).onDelete("cascade"),
  ],
);

export const passkey = pgTable(
  "passkey",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    name: varchar({ length: 255 }),
    publicKey: text().notNull(),
    userId: varchar({ length: 36 }).notNull(),
    credentialId: text().notNull(),
    counter: integer().default(0).notNull(),
    deviceType: varchar({ length: 50 }).notNull(),
    backedUp: boolean().default(false).notNull(),
    transports: text(),
    aaguid: varchar({ length: 255 }),
    createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "passkey_userId_fkey",
    }).onDelete("cascade"),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    type: postType().default("article").notNull(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    regionId: varchar("region_id", { length: 36 }),
    title: varchar({ length: 500 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    shortDescription: text("short_description"),
    content: jsonb(),
    coverImage: varchar("cover_image", { length: 500 }),
    status: contentStatus().default("draft").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    eventDate: timestamp("event_date", { withTimezone: true, mode: "string" }),
    eventEndDate: timestamp("event_end_date", {
      withTimezone: true,
      mode: "string",
    }),
    displayOrder: integer("display_order"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_posts_author").using(
      "btree",
      table.authorId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_posts_display_order").using(
      "btree",
      table.displayOrder.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_posts_fulltext").using(
      "gin",
      sql`to_tsvector('english'::regconfig, (((COALESCE(title, ''::charac`,
    ),
    index("idx_posts_published").using(
      "btree",
      table.publishedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_posts_region").using(
      "btree",
      table.regionId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("idx_posts_slug_active")
      .using("btree", table.slug.asc().nullsLast().op("text_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("idx_posts_slug_all").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    index("idx_posts_status").using(
      "btree",
      table.status.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_posts_type").using(
      "btree",
      table.type.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_posts_type_status")
      .using(
        "btree",
        table.type.asc().nullsLast().op("enum_ops"),
        table.status.asc().nullsLast().op("enum_ops"),
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "posts_author_id_fkey",
    }),
    foreignKey({
      columns: [table.regionId],
      foreignColumns: [regions.id],
      name: "posts_region_id_fkey",
    }),
  ],
);

export const regions = pgTable(
  "regions",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text(),
    coverImage: varchar("cover_image", { length: 500 }),
    mapData: jsonb("map_data"),
    attractionRank: integer("attraction_rank"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    status: contentStatus().default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    province: varchar({ length: 255 }),
    district: varchar({ length: 255 }),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
  },
  (table) => [
    index("idx_regions_district")
      .using("btree", table.district.asc().nullsLast().op("text_ops"))
      .where(sql`(district IS NOT NULL)`),
    index("idx_regions_fulltext").using(
      "gin",
      sql`to_tsvector('english'::regconfig, (((COALESCE(name, ''::charact`,
    ),
    index("idx_regions_province")
      .using("btree", table.province.asc().nullsLast().op("text_ops"))
      .where(sql`(province IS NOT NULL)`),
    index("idx_regions_rank").using(
      "btree",
      table.attractionRank.asc().nullsLast().op("int4_ops"),
    ),
    uniqueIndex("idx_regions_slug_active")
      .using("btree", table.slug.asc().nullsLast().op("text_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("idx_regions_slug_all").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    index("idx_regions_status").using(
      "btree",
      table.status.asc().nullsLast().op("enum_ops"),
    ),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "regions_author_id_fkey",
    }),
  ],
);

export const photoFeatures = pgTable(
  "photo_features",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    regionId: varchar("region_id", { length: 36 }),
    title: varchar({ length: 500 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text(),
    status: contentStatus().default("draft").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    displayOrder: integer("display_order"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_photo_features_author").using(
      "btree",
      table.authorId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_photo_features_region").using(
      "btree",
      table.regionId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("idx_photo_features_slug_active")
      .using("btree", table.slug.asc().nullsLast().op("text_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("idx_photo_features_slug_all").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "photo_features_author_id_fkey",
    }),
    foreignKey({
      columns: [table.regionId],
      foreignColumns: [regions.id],
      name: "photo_features_region_id_fkey",
    }),
  ],
);

export const photoImages = pgTable(
  "photo_images",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    photoFeatureId: varchar("photo_feature_id", { length: 36 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }).notNull(),
    caption: text(),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_photo_images_feature").using(
      "btree",
      table.photoFeatureId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.photoFeatureId],
      foreignColumns: [photoFeatures.id],
      name: "photo_images_photo_feature_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const videos = pgTable(
  "videos",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    regionId: varchar("region_id", { length: 36 }),
    title: varchar({ length: 500 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text(),
    platform: videoPlatform().default("youtube").notNull(),
    videoUrl: varchar("video_url", { length: 500 }).notNull(),
    videoId: varchar("video_id", { length: 100 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
    duration: integer(),
    status: contentStatus().default("draft").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    displayOrder: integer("display_order"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_videos_author").using(
      "btree",
      table.authorId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_videos_fulltext").using(
      "gin",
      sql`to_tsvector('english'::regconfig, (((COALESCE(title, ''::charac`,
    ),
    index("idx_videos_platform").using(
      "btree",
      table.platform.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_videos_region").using(
      "btree",
      table.regionId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("idx_videos_slug_active")
      .using("btree", table.slug.asc().nullsLast().op("text_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("idx_videos_slug_all").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "videos_author_id_fkey",
    }),
    foreignKey({
      columns: [table.regionId],
      foreignColumns: [regions.id],
      name: "videos_region_id_fkey",
    }),
  ],
);

export const hotels = pgTable(
  "hotels",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    authorId: varchar("author_id", { length: 36 }).notNull(),
    regionId: varchar("region_id", { length: 36 }),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text(),
    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    website: varchar({ length: 500 }),
    starRating: smallint("star_rating"),
    priceRange: hotelPriceRange("price_range"),
    amenities: jsonb(),
    coverImage: varchar("cover_image", { length: 500 }),
    gallery: jsonb(),
    status: contentStatus().default("draft").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    displayOrder: integer("display_order"),
    isFeatured: boolean("is_featured").default(false).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_hotels_author").using(
      "btree",
      table.authorId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_hotels_fulltext").using(
      "gin",
      sql`to_tsvector('english'::regconfig, (((COALESCE(name, ''::charact`,
    ),
    index("idx_hotels_region").using(
      "btree",
      table.regionId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("idx_hotels_slug_active")
      .using("btree", table.slug.asc().nullsLast().op("text_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("idx_hotels_slug_all").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "hotels_author_id_fkey",
    }),
    foreignKey({
      columns: [table.regionId],
      foreignColumns: [regions.id],
      name: "hotels_region_id_fkey",
    }),
  ],
);

export const hotelBranches = pgTable(
  "hotel_branches",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    hotelId: varchar("hotel_id", { length: 36 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    address: text(),
    phone: varchar({ length: 50 }),
    email: varchar({ length: 255 }),
    coordinates: jsonb(),
    isMain: boolean("is_main").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_hotel_branches_hotel").using(
      "btree",
      table.hotelId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.hotelId],
      foreignColumns: [hotels.id],
      name: "hotel_branches_hotel_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const contentLikes = pgTable(
  "content_likes",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    targetType: likeTargetType("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    viewerHash: varchar("viewer_hash", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_content_likes_target").using(
      "btree",
      table.targetType.asc().nullsLast().op("text_ops"),
      table.targetId.asc().nullsLast().op("text_ops"),
    ),
    unique("content_likes_target_type_target_id_viewer_hash_key").on(
      table.targetType,
      table.targetId,
      table.viewerHash,
    ),
  ],
);

export const contentViews = pgTable(
  "content_views",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    targetType: viewTargetType("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    viewerHash: varchar("viewer_hash", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    referrer: varchar({ length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_content_views_created").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_content_views_dedup").using(
      "btree",
      table.targetType.asc().nullsLast().op("timestamptz_ops"),
      table.targetId.asc().nullsLast().op("timestamptz_ops"),
      table.viewerHash.asc().nullsLast().op("enum_ops"),
      table.createdAt.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_content_views_target").using(
      "btree",
      table.targetType.asc().nullsLast().op("enum_ops"),
      table.targetId.asc().nullsLast().op("enum_ops"),
    ),
  ],
);

export const viewAggregates = pgTable(
  "view_aggregates",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    targetType: viewTargetType("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    viewDate: date("view_date").notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    uniqueViewers: integer("unique_viewers").default(0).notNull(),
  },
  (table) => [
    index("idx_view_aggregates_date").using(
      "btree",
      table.viewDate.asc().nullsLast().op("date_ops"),
    ),
    index("idx_view_aggregates_target").using(
      "btree",
      table.targetType.asc().nullsLast().op("text_ops"),
      table.targetId.asc().nullsLast().op("enum_ops"),
    ),
    unique("view_aggregates_target_type_target_id_view_date_key").on(
      table.targetType,
      table.targetId,
      table.viewDate,
    ),
  ],
);

export const contentLinks = pgTable(
  "content_links",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    sourceType: contentLinkSource("source_type").notNull(),
    sourceId: varchar("source_id", { length: 36 }).notNull(),
    targetType: contentLinkTarget("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_content_links_source").using(
      "btree",
      table.sourceType.asc().nullsLast().op("enum_ops"),
      table.sourceId.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_content_links_target").using(
      "btree",
      table.targetType.asc().nullsLast().op("text_ops"),
      table.targetId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 100 }).notNull(),
    tagType: tagType("tag_type").default("general").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_tags_slug").using(
      "btree",
      table.slug.asc().nullsLast().op("text_ops"),
    ),
    index("idx_tags_type").using(
      "btree",
      table.tagType.asc().nullsLast().op("enum_ops"),
    ),
    unique("tags_name_key").on(table.name),
    unique("tags_slug_key").on(table.slug),
  ],
);

export const contentTags = pgTable(
  "content_tags",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    tagId: varchar("tag_id", { length: 36 }).notNull(),
    targetType: contentTagTarget("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
  },
  (table) => [
    index("idx_content_tags_tag").using(
      "btree",
      table.tagId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_content_tags_target").using(
      "btree",
      table.targetType.asc().nullsLast().op("text_ops"),
      table.targetId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.id],
      name: "content_tags_tag_id_fkey",
    }).onDelete("cascade"),
    unique("content_tags_tag_id_target_type_target_id_key").on(
      table.tagId,
      table.targetType,
      table.targetId,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    recipientId: varchar("recipient_id", { length: 36 }).notNull(),
    actorId: varchar("actor_id", { length: 36 }),
    type: notificationType().notNull(),
    title: varchar({ length: 255 }).notNull(),
    message: text(),
    targetType: varchar("target_type", { length: 50 }),
    targetId: varchar("target_id", { length: 36 }),
    actionUrl: varchar("action_url", { length: 500 }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_notifications_read").using(
      "btree",
      table.isRead.asc().nullsLast().op("bool_ops"),
    ),
    index("idx_notifications_recipient").using(
      "btree",
      table.recipientId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_notifications_type").using(
      "btree",
      table.type.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_notifications_unread")
      .using(
        "btree",
        table.recipientId.asc().nullsLast().op("bool_ops"),
        table.isRead.asc().nullsLast().op("bool_ops"),
      )
      .where(sql`(is_read = false)`),
    foreignKey({
      columns: [table.recipientId],
      foreignColumns: [user.id],
      name: "notifications_recipient_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [user.id],
      name: "notifications_actor_id_fkey",
    }).onDelete("set null"),
  ],
);

export const media = pgTable(
  "media",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    filename: varchar({ length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer().notNull(),
    type: mediaType().default("image").notNull(),
    width: integer(),
    height: integer(),
    blurHash: varchar("blur_hash", { length: 100 }),
    thumbnailPath: varchar("thumbnail_path", { length: 255 }),
    alt: varchar({ length: 255 }),
    caption: text(),
    uploadedBy: varchar("uploaded_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_media_type").using(
      "btree",
      table.type.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_media_uploader").using(
      "btree",
      table.uploadedBy.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [user.id],
      name: "media_uploaded_by_fkey",
    }),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    parentId: varchar("parent_id", { length: 36 }),
    targetType: commentTargetType("target_type").notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    guestName: varchar("guest_name", { length: 100 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }).notNull(),
    content: text().notNull(),
    status: commentStatus().default("pending").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    viewerHash: varchar("viewer_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_comments_approved")
      .using(
        "btree",
        table.targetType.asc().nullsLast().op("text_ops"),
        table.targetId.asc().nullsLast().op("enum_ops"),
        table.status.asc().nullsLast().op("enum_ops"),
      )
      .where(sql`(status = 'approved'::comment_status)`),
    index("idx_comments_parent").using(
      "btree",
      table.parentId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_comments_status").using(
      "btree",
      table.status.asc().nullsLast().op("enum_ops"),
    ),
    index("idx_comments_target").using(
      "btree",
      table.targetType.asc().nullsLast().op("text_ops"),
      table.targetId.asc().nullsLast().op("enum_ops"),
    ),
  ],
);

export const heroSlides = pgTable(
  "hero_slides",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    contentType: heroContentType("content_type").notNull(),
    contentId: varchar("content_id", { length: 36 }),
    customTitle: varchar("custom_title", { length: 500 }),
    customDescription: text("custom_description"),
    customImage: varchar("custom_image", { length: 500 }),
    customLink: varchar("custom_link", { length: 500 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_hero_slides_active").using(
      "btree",
      table.isActive.asc().nullsLast().op("bool_ops"),
    ),
    index("idx_hero_slides_order").using(
      "btree",
      table.sortOrder.asc().nullsLast().op("int4_ops"),
    ),
  ],
);
