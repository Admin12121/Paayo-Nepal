#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
}

/// Initialize database tables if they don't exist.
/// Schema matches the Drizzle ORM definitions in the frontend.
pub async fn init_tables(pool: &sqlx::MySqlPool) -> Result<(), sqlx::Error> {
    tracing::info!("Checking and creating database tables...");

    // BetterAuth tables (shared with frontend)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `user` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `email` varchar(255) NOT NULL UNIQUE,
            `email_verified` tinyint(1) DEFAULT 0,
            `name` varchar(255),
            `image` text,
            `role` varchar(20) NOT NULL DEFAULT 'editor',
            `is_active` tinyint(1) NOT NULL DEFAULT 0,
            `banned_at` timestamp NULL,
            `two_factor_enabled` tinyint(1) DEFAULT 0,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Add columns if table already exists without them
    sqlx::query(
        r#"
        ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `two_factor_enabled` tinyint(1) DEFAULT 0 AFTER `role`
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) NOT NULL DEFAULT 0 AFTER `role`
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `banned_at` timestamp NULL AFTER `is_active`
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        ALTER TABLE `user` ALTER COLUMN `role` SET DEFAULT 'editor'
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `session` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `user_id` varchar(36) NOT NULL,
            `token` varchar(255) NOT NULL UNIQUE,
            `expires_at` timestamp NOT NULL,
            `ip_address` varchar(45),
            `user_agent` text,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Add updated_at column if session table already exists without it
    sqlx::query(
        r#"
        ALTER TABLE `session` ADD COLUMN IF NOT EXISTS `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `account` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `user_id` varchar(36) NOT NULL,
            `account_id` varchar(255) NOT NULL,
            `provider_id` varchar(255) NOT NULL,
            `access_token` text,
            `refresh_token` text,
            `access_token_expires_at` timestamp NULL,
            `refresh_token_expires_at` timestamp NULL,
            `scope` text,
            `id_token` text,
            `password` text,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `verification` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `identifier` varchar(255) NOT NULL,
            `value` varchar(255) NOT NULL,
            `expires_at` timestamp NOT NULL,
            `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // BetterAuth twoFactor plugin table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `twoFactor` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `userId` varchar(36) NOT NULL,
            `secret` text,
            `backupCodes` text,
            FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // BetterAuth passkey plugin table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `passkey` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `name` varchar(255),
            `publicKey` text NOT NULL,
            `userId` varchar(36) NOT NULL,
            `credentialID` text NOT NULL,
            `counter` int NOT NULL DEFAULT 0,
            `deviceType` varchar(50) NOT NULL,
            `backedUp` tinyint(1) NOT NULL DEFAULT 0,
            `transports` text,
            `aaguid` varchar(255),
            `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Posts
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `posts` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `slug` varchar(255) NOT NULL UNIQUE,
            `title` varchar(500) NOT NULL,
            `excerpt` text,
            `content` text NOT NULL,
            `featured_image` varchar(255),
            `featured_image_blur` varchar(100),
            `type` enum('blog','article','news') NOT NULL DEFAULT 'blog',
            `status` enum('draft','pending','published','archived') NOT NULL DEFAULT 'draft',
            `author_id` varchar(36) NOT NULL,
            `approved_by` varchar(36),
            `approved_at` timestamp NULL,
            `published_at` timestamp NULL,
            `views` int NOT NULL DEFAULT 0,
            `likes` int NOT NULL DEFAULT 0,
            `meta_title` varchar(255),
            `meta_description` text,
            `tags` json,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `slug_idx` (`slug`),
            INDEX `status_idx` (`status`),
            INDEX `author_idx` (`author_id`),
            INDEX `published_idx` (`published_at`),
            INDEX `type_idx` (`type`),
            FOREIGN KEY (`author_id`) REFERENCES `user`(`id`),
            FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Post Likes
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `post_likes` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `post_id` varchar(36) NOT NULL,
            `user_id` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `unique_like` (`post_id`, `user_id`),
            FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Media
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `media` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `filename` varchar(255) NOT NULL,
            `original_name` varchar(255) NOT NULL,
            `mime_type` varchar(100) NOT NULL,
            `size` int NOT NULL,
            `type` enum('image','video_link','document') NOT NULL DEFAULT 'image',
            `width` int,
            `height` int,
            `blur_hash` varchar(100),
            `thumbnail_path` varchar(255),
            `alt` varchar(255),
            `caption` text,
            `uploaded_by` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `type_idx` (`type`),
            INDEX `uploader_idx` (`uploaded_by`),
            FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Video Links
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `video_links` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `title` varchar(500) NOT NULL,
            `url` varchar(500) NOT NULL,
            `thumbnail_url` varchar(500),
            `platform` varchar(50),
            `duration` varchar(20),
            `views` int DEFAULT 0,
            `featured` tinyint(1) DEFAULT 0,
            `uploaded_by` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Comments
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `comments` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `post_id` varchar(36) NOT NULL,
            `user_id` varchar(36) NOT NULL,
            `parent_id` varchar(36),
            `content` text NOT NULL,
            `likes` int NOT NULL DEFAULT 0,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `post_idx` (`post_id`),
            INDEX `user_idx` (`user_id`),
            INDEX `parent_idx` (`parent_id`),
            FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Comment Likes
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `comment_likes` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `comment_id` varchar(36) NOT NULL,
            `user_id` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `unique_comment_like` (`comment_id`, `user_id`),
            FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Regions
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `regions` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `slug` varchar(255) NOT NULL UNIQUE,
            `name` varchar(255) NOT NULL,
            `description` text,
            `featured_image` varchar(255),
            `featured_image_blur` varchar(100),
            `latitude` decimal(10,8),
            `longitude` decimal(11,8),
            `province` varchar(100),
            `district` varchar(100),
            `display_order` int NOT NULL DEFAULT 0,
            `created_by` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `region_slug_idx` (`slug`),
            INDEX `order_idx` (`display_order`),
            INDEX `province_idx` (`province`),
            FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Activities
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `activities` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `slug` varchar(255) NOT NULL UNIQUE,
            `name` varchar(255) NOT NULL,
            `description` text,
            `content` text,
            `featured_image` varchar(255),
            `featured_image_blur` varchar(100),
            `hero_image` varchar(255),
            `icon` varchar(100),
            `display_order` int NOT NULL DEFAULT 0,
            `is_active` tinyint(1) NOT NULL DEFAULT 1,
            `created_by` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `activity_slug_idx` (`slug`),
            INDEX `activity_order_idx` (`display_order`),
            INDEX `active_idx` (`is_active`),
            FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Activity Gallery
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `activity_gallery` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `activity_id` varchar(36) NOT NULL,
            `media_id` varchar(36) NOT NULL,
            `display_order` int DEFAULT 0,
            INDEX `gallery_activity_idx` (`activity_id`),
            INDEX `gallery_order_idx` (`display_order`),
            FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Events
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `events` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `slug` varchar(255) NOT NULL UNIQUE,
            `title` varchar(500) NOT NULL,
            `description` text,
            `content` text,
            `featured_image` varchar(255),
            `featured_image_blur` varchar(100),
            `start_date` date NOT NULL,
            `end_date` date,
            `start_time` time,
            `end_time` time,
            `location` varchar(255),
            `region_id` varchar(36),
            `is_recurring` tinyint(1) NOT NULL DEFAULT 0,
            `recurring_pattern` json,
            `is_featured` tinyint(1) NOT NULL DEFAULT 0,
            `views` int NOT NULL DEFAULT 0,
            `created_by` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `event_slug_idx` (`slug`),
            INDEX `date_idx` (`start_date`),
            INDEX `event_region_idx` (`region_id`),
            INDEX `featured_idx` (`is_featured`),
            FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Attractions
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `attractions` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `slug` varchar(255) NOT NULL UNIQUE,
            `name` varchar(255) NOT NULL,
            `description` text,
            `content` text,
            `featured_image` varchar(255),
            `featured_image_blur` varchar(100),
            `region_id` varchar(36),
            `latitude` decimal(10,8),
            `longitude` decimal(11,8),
            `address` varchar(500),
            `opening_hours` json,
            `entry_fee` varchar(100),
            `is_top_attraction` tinyint(1) NOT NULL DEFAULT 0,
            `views` int NOT NULL DEFAULT 0,
            `rating` decimal(2,1),
            `review_count` int NOT NULL DEFAULT 0,
            `created_by` varchar(36) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `attraction_slug_idx` (`slug`),
            INDEX `attraction_region_idx` (`region_id`),
            INDEX `top_idx` (`is_top_attraction`),
            INDEX `views_idx` (`views`),
            FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`),
            FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Attraction Activities (many-to-many)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `attraction_activities` (
            `attraction_id` varchar(36) NOT NULL,
            `activity_id` varchar(36) NOT NULL,
            PRIMARY KEY (`attraction_id`, `activity_id`),
            FOREIGN KEY (`attraction_id`) REFERENCES `attractions`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    // Notifications
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS `notifications` (
            `id` varchar(36) NOT NULL PRIMARY KEY,
            `user_id` varchar(36) NOT NULL,
            `type` varchar(50) NOT NULL,
            `title` varchar(255) NOT NULL,
            `message` text,
            `link` varchar(500),
            `is_read` tinyint(1) NOT NULL DEFAULT 0,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `notif_user_idx` (`user_id`),
            INDEX `notif_read_idx` (`is_read`),
            INDEX `notif_type_idx` (`type`),
            FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(pool)
    .await?;

    tracing::info!("Database tables initialized successfully");
    Ok(())
}

/// Seed the admin user if it doesn't already exist.
/// Creates entries in both `user` and `account` tables (BetterAuth credential format).
pub async fn seed_admin(pool: &sqlx::MySqlPool) -> Result<(), sqlx::Error> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM `user` WHERE email = 'vickytaj6459@gmail.com'")
            .fetch_optional(pool)
            .await?;

    if existing.is_some() {
        tracing::info!("Admin user already exists, skipping seed");
        return Ok(());
    }

    tracing::info!("Seeding admin user...");

    let user_id = uuid::Uuid::new_v4().to_string();
    let account_id = uuid::Uuid::new_v4().to_string();

    // Hash password with bcrypt cost 10 (BetterAuth default)
    let password_hash = bcrypt::hash("admin@#12", 10)
        .map_err(|e| sqlx::Error::Protocol(format!("bcrypt error: {}", e)))?;

    // Insert user record
    sqlx::query(
        r#"INSERT INTO `user` (`id`, `email`, `email_verified`, `name`, `role`, `is_active`, `created_at`, `updated_at`)
           VALUES (?, 'vickytaj6459@gmail.com', 1, 'admin12121', 'admin', 1, NOW(), NOW())"#,
    )
    .bind(&user_id)
    .execute(pool)
    .await?;

    // Insert account record (BetterAuth credential format)
    sqlx::query(
        r#"INSERT INTO `account` (`id`, `user_id`, `account_id`, `provider_id`, `password`, `created_at`, `updated_at`)
           VALUES (?, ?, ?, 'credential', ?, NOW(), NOW())"#,
    )
    .bind(&account_id)
    .bind(&user_id)
    .bind(&user_id)
    .bind(&password_hash)
    .execute(pool)
    .await?;

    tracing::info!("Admin user seeded successfully (email: vickytaj6459@gmail.com)");
    Ok(())
}
