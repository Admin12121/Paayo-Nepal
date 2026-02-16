-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."comment_status" AS ENUM('pending', 'approved', 'spam', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."comment_target_type" AS ENUM('post', 'video', 'photo', 'hotel');--> statement-breakpoint
CREATE TYPE "public"."content_link_source" AS ENUM('post', 'region');--> statement-breakpoint
CREATE TYPE "public"."content_link_target" AS ENUM('photo', 'video', 'post');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."content_tag_target" AS ENUM('post', 'video', 'photo', 'hotel');--> statement-breakpoint
CREATE TYPE "public"."hero_content_type" AS ENUM('post', 'video', 'photo', 'custom');--> statement-breakpoint
CREATE TYPE "public"."hotel_price_range" AS ENUM('budget', 'mid', 'luxury');--> statement-breakpoint
CREATE TYPE "public"."like_target_type" AS ENUM('post', 'video', 'photo');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'document');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_user', 'verified', 'content', 'comment', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('article', 'event', 'activity', 'explore');--> statement-breakpoint
CREATE TYPE "public"."tag_type" AS ENUM('activity', 'category', 'general');--> statement-breakpoint
CREATE TYPE "public"."video_platform" AS ENUM('youtube', 'vimeo', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."view_target_type" AS ENUM('post', 'video', 'photo', 'hotel');--> statement-breakpoint
CREATE TABLE "_sqlx_migrations" (
	"version" bigint PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"installed_on" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"checksum" "bytea" NOT NULL,
	"execution_time" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false,
	"name" varchar(255),
	"image" text,
	"role" varchar(20) DEFAULT 'editor' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" varchar(36) NOT NULL,
	"secret" text,
	"backupCodes" text
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"publicKey" text NOT NULL,
	"userId" varchar(36) NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"deviceType" varchar(50) NOT NULL,
	"backedUp" boolean DEFAULT false NOT NULL,
	"transports" text,
	"aaguid" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"type" "post_type" DEFAULT 'article' NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"region_id" varchar(36),
	"title" varchar(500) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"short_description" text,
	"content" jsonb,
	"cover_image" varchar(500),
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"event_date" timestamp with time zone,
	"event_end_date" timestamp with time zone,
	"display_order" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_image" varchar(500),
	"map_data" jsonb,
	"attraction_rank" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"province" varchar(255),
	"district" varchar(255),
	"latitude" double precision,
	"longitude" double precision
);
--> statement-breakpoint
CREATE TABLE "photo_features" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"region_id" varchar(36),
	"title" varchar(500) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"display_order" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photo_images" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"photo_feature_id" varchar(36) NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"caption" text,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"region_id" varchar(36),
	"title" varchar(500) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"platform" "video_platform" DEFAULT 'youtube' NOT NULL,
	"video_url" varchar(500) NOT NULL,
	"video_id" varchar(100),
	"thumbnail_url" varchar(500),
	"duration" integer,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"display_order" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"region_id" varchar(36),
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(500),
	"star_rating" smallint,
	"price_range" "hotel_price_range",
	"amenities" jsonb,
	"cover_image" varchar(500),
	"gallery" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"display_order" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hotel_branches" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"hotel_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"coordinates" jsonb,
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_likes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"target_type" "like_target_type" NOT NULL,
	"target_id" varchar(36) NOT NULL,
	"viewer_hash" varchar(64) NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_likes_target_type_target_id_viewer_hash_key" UNIQUE("target_type","target_id","viewer_hash")
);
--> statement-breakpoint
CREATE TABLE "content_views" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"target_type" "view_target_type" NOT NULL,
	"target_id" varchar(36) NOT NULL,
	"viewer_hash" varchar(64) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"referrer" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "view_aggregates" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"target_type" "view_target_type" NOT NULL,
	"target_id" varchar(36) NOT NULL,
	"view_date" date NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"unique_viewers" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "view_aggregates_target_type_target_id_view_date_key" UNIQUE("target_type","target_id","view_date")
);
--> statement-breakpoint
CREATE TABLE "content_links" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"source_type" "content_link_source" NOT NULL,
	"source_id" varchar(36) NOT NULL,
	"target_type" "content_link_target" NOT NULL,
	"target_id" varchar(36) NOT NULL,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"tag_type" "tag_type" DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_key" UNIQUE("name"),
	CONSTRAINT "tags_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_tags" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tag_id" varchar(36) NOT NULL,
	"target_type" "content_tag_target" NOT NULL,
	"target_id" varchar(36) NOT NULL,
	CONSTRAINT "content_tags_tag_id_target_type_target_id_key" UNIQUE("tag_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"recipient_id" varchar(36) NOT NULL,
	"actor_id" varchar(36),
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"target_type" varchar(50),
	"target_id" varchar(36),
	"action_url" varchar(500),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"type" "media_type" DEFAULT 'image' NOT NULL,
	"width" integer,
	"height" integer,
	"blur_hash" varchar(100),
	"thumbnail_path" varchar(255),
	"alt" varchar(255),
	"caption" text,
	"uploaded_by" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"parent_id" varchar(36),
	"target_type" "comment_target_type" NOT NULL,
	"target_id" varchar(36) NOT NULL,
	"guest_name" varchar(100) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"status" "comment_status" DEFAULT 'pending' NOT NULL,
	"ip_address" varchar(45),
	"viewer_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero_slides" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"content_type" "hero_content_type" NOT NULL,
	"content_id" varchar(36),
	"custom_title" varchar(500),
	"custom_description" text,
	"custom_image" varchar(500),
	"custom_link" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_features" ADD CONSTRAINT "photo_features_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_features" ADD CONSTRAINT "photo_features_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_images" ADD CONSTRAINT "photo_images_photo_feature_id_fkey" FOREIGN KEY ("photo_feature_id") REFERENCES "public"."photo_features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_branches" ADD CONSTRAINT "hotel_branches_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_posts_author" ON "posts" USING btree ("author_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_display_order" ON "posts" USING btree ("display_order" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_fulltext" ON "posts" USING gin (to_tsvector('english'::regconfig, (((COALESCE(title, ''::charac tsvector_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_published" ON "posts" USING btree ("published_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_region" ON "posts" USING btree ("region_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posts_slug_active" ON "posts" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_posts_slug_all" ON "posts" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_status" ON "posts" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_type" ON "posts" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_posts_type_status" ON "posts" USING btree ("type" enum_ops,"status" enum_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_regions_district" ON "regions" USING btree ("district" text_ops) WHERE (district IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_regions_fulltext" ON "regions" USING gin (to_tsvector('english'::regconfig, (((COALESCE(name, ''::charact tsvector_ops);--> statement-breakpoint
CREATE INDEX "idx_regions_province" ON "regions" USING btree ("province" text_ops) WHERE (province IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_regions_rank" ON "regions" USING btree ("attraction_rank" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_regions_slug_active" ON "regions" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_regions_slug_all" ON "regions" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_regions_status" ON "regions" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_photo_features_author" ON "photo_features" USING btree ("author_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_photo_features_region" ON "photo_features" USING btree ("region_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_photo_features_slug_active" ON "photo_features" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_photo_features_slug_all" ON "photo_features" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_photo_images_feature" ON "photo_images" USING btree ("photo_feature_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_videos_author" ON "videos" USING btree ("author_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_videos_fulltext" ON "videos" USING gin (to_tsvector('english'::regconfig, (((COALESCE(title, ''::charac tsvector_ops);--> statement-breakpoint
CREATE INDEX "idx_videos_platform" ON "videos" USING btree ("platform" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_videos_region" ON "videos" USING btree ("region_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_videos_slug_active" ON "videos" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_videos_slug_all" ON "videos" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_hotels_author" ON "hotels" USING btree ("author_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_hotels_fulltext" ON "hotels" USING gin (to_tsvector('english'::regconfig, (((COALESCE(name, ''::charact tsvector_ops);--> statement-breakpoint
CREATE INDEX "idx_hotels_region" ON "hotels" USING btree ("region_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hotels_slug_active" ON "hotels" USING btree ("slug" text_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_hotels_slug_all" ON "hotels" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_hotel_branches_hotel" ON "hotel_branches" USING btree ("hotel_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_content_likes_target" ON "content_likes" USING btree ("target_type" text_ops,"target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_content_views_created" ON "content_views" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_content_views_dedup" ON "content_views" USING btree ("target_type" timestamptz_ops,"target_id" timestamptz_ops,"viewer_hash" enum_ops,"created_at" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_content_views_target" ON "content_views" USING btree ("target_type" enum_ops,"target_id" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_view_aggregates_date" ON "view_aggregates" USING btree ("view_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_view_aggregates_target" ON "view_aggregates" USING btree ("target_type" text_ops,"target_id" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_content_links_source" ON "content_links" USING btree ("source_type" enum_ops,"source_id" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_content_links_target" ON "content_links" USING btree ("target_type" text_ops,"target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tags_slug" ON "tags" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tags_type" ON "tags" USING btree ("tag_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_content_tags_tag" ON "content_tags" USING btree ("tag_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_content_tags_target" ON "content_tags" USING btree ("target_type" text_ops,"target_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("is_read" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("recipient_id" bool_ops,"is_read" bool_ops) WHERE (is_read = false);--> statement-breakpoint
CREATE INDEX "idx_media_type" ON "media" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_media_uploader" ON "media" USING btree ("uploaded_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_comments_approved" ON "comments" USING btree ("target_type" text_ops,"target_id" enum_ops,"status" enum_ops) WHERE (status = 'approved'::comment_status);--> statement-breakpoint
CREATE INDEX "idx_comments_parent" ON "comments" USING btree ("parent_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_comments_status" ON "comments" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_comments_target" ON "comments" USING btree ("target_type" text_ops,"target_id" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_hero_slides_active" ON "hero_slides" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_hero_slides_order" ON "hero_slides" USING btree ("sort_order" int4_ops);
*/