use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError, models::post::Post, services::CacheService, utils::slug::generate_slug,
};

/// Maximum number of attempts to insert a post with a unique slug before giving up.
const MAX_SLUG_RETRIES: usize = 5;

pub struct PostService {
    db: PgPool,
    cache: CacheService,
}

impl PostService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List posts with optional filters. Always excludes soft-deleted posts.
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        status: Option<&str>,
        post_type: Option<&str>,
        author_id: Option<&str>,
        region_id: Option<&str>,
        is_featured: Option<bool>,
        sort_by: Option<&str>,
    ) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        // Build dynamic query with numbered parameters
        let mut where_clauses = vec!["deleted_at IS NULL".to_string()];
        let mut param_idx: usize = 0;
        let mut bind_values: Vec<String> = Vec::new();

        if let Some(s) = status {
            param_idx += 1;
            where_clauses.push(format!("status = ${}::content_status", param_idx));
            bind_values.push(s.to_string());
        }

        if let Some(t) = post_type {
            param_idx += 1;
            where_clauses.push(format!("type = ${}", param_idx));
            bind_values.push(t.to_string());
        }

        if let Some(a) = author_id {
            param_idx += 1;
            where_clauses.push(format!("author_id = ${}", param_idx));
            bind_values.push(a.to_string());
        }

        if let Some(r) = region_id {
            param_idx += 1;
            where_clauses.push(format!("region_id = ${}", param_idx));
            bind_values.push(r.to_string());
        }

        if let Some(f) = is_featured {
            param_idx += 1;
            where_clauses.push(format!("is_featured = ${}", param_idx));
            bind_values.push(f.to_string());
        }

        let where_sql = where_clauses.join(" AND ");

        let order_clause = match sort_by {
            Some("latest") => "created_at DESC",
            Some("oldest") => "created_at ASC",
            Some("most_liked") => "like_count DESC, created_at DESC",
            Some("most_viewed") => "view_count DESC, created_at DESC",
            // Default: featured-first ordering per PROJECT.md
            // Featured posts (with display_order) come first sorted by display_order,
            // then non-featured posts sorted by publish date.
            _ => "is_featured DESC, CASE WHEN display_order IS NOT NULL THEN 0 ELSE 1 END, display_order ASC, published_at DESC NULLS LAST, created_at DESC",
        };

        // Data query
        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;
        let data_sql = format!(
            "SELECT * FROM posts WHERE {} ORDER BY {} LIMIT ${} OFFSET ${}",
            where_sql, order_clause, limit_idx, offset_idx
        );

        let count_sql = format!("SELECT COUNT(*) FROM posts WHERE {}", where_sql);

        // Build and execute the data query
        let mut data_q = sqlx::query_as::<_, Post>(&data_sql);
        for b in &bind_values {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit as i64).bind(offset as i64);
        let posts: Vec<Post> = data_q.fetch_all(&self.db).await?;

        // Build and execute the count query
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &bind_values {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((posts, total.0))
    }

    /// Get a post by slug. Excludes soft-deleted posts.
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Post>, ApiError> {
        let post =
            sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE slug = $1 AND deleted_at IS NULL")
                .bind(slug)
                .fetch_optional(&self.db)
                .await?;

        Ok(post)
    }

    /// Get a post by ID. Excludes soft-deleted posts.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<Post>, ApiError> {
        let post =
            sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE id = $1 AND deleted_at IS NULL")
                .bind(id)
                .fetch_optional(&self.db)
                .await?;

        Ok(post)
    }

    /// Get a post by ID including soft-deleted (for admin restore).
    pub async fn get_by_id_including_deleted(&self, id: &str) -> Result<Option<Post>, ApiError> {
        let post = sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(post)
    }

    /// Create a new post with correct column names matching the database schema.
    ///
    /// Handles slug collisions by retrying with a freshly-generated slug up to
    /// [`MAX_SLUG_RETRIES`] times. Because `generate_slug` appends a random
    /// 8-character UUID fragment, collisions are extremely unlikely but this
    /// loop guarantees correctness even under high concurrency (fix 5.10).
    pub async fn create(
        &self,
        post_type: &str,
        author_id: &str,
        title: &str,
        short_description: Option<&str>,
        content: Option<&serde_json::Value>,
        cover_image: Option<&str>,
        region_id: Option<&str>,
        is_featured: bool,
        event_date: Option<&str>,
        event_end_date: Option<&str>,
    ) -> Result<Post, ApiError> {
        let id = Uuid::new_v4().to_string();

        let mut last_error: Option<sqlx::Error> = None;

        for attempt in 0..MAX_SLUG_RETRIES {
            let slug = generate_slug(title);

            let result = sqlx::query(
                r#"
                INSERT INTO posts (
                    id, type, author_id, title, slug, short_description, content,
                    cover_image, region_id, is_featured, event_date, event_end_date,
                    status, like_count, view_count, created_at, updated_at
                )
                VALUES (
                    $1, $2::post_type, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11::timestamptz, $12::timestamptz,
                    'draft', 0, 0, NOW(), NOW()
                )
                "#,
            )
            .bind(&id)
            .bind(post_type)
            .bind(author_id)
            .bind(title)
            .bind(&slug)
            .bind(short_description)
            .bind(content)
            .bind(cover_image)
            .bind(region_id)
            .bind(is_featured)
            .bind(event_date)
            .bind(event_end_date)
            .execute(&self.db)
            .await;

            match result {
                Ok(_) => {
                    // Invalidate cache
                    let _ = self.cache.invalidate("posts:*").await;

                    return self
                        .get_by_id(&id)
                        .await?
                        .ok_or(ApiError::InternalServerError);
                }
                Err(e) => {
                    // Check for unique constraint violation (PostgreSQL error code 23505)
                    if is_unique_violation(&e) {
                        tracing::warn!(
                            "Slug collision on attempt {} for title '{}', slug '{}'. Retrying...",
                            attempt + 1,
                            title,
                            slug,
                        );
                        last_error = Some(e);
                        continue;
                    }
                    // Any other DB error — propagate immediately
                    return Err(ApiError::DatabaseError(e));
                }
            }
        }

        // All retry attempts exhausted
        tracing::error!(
            "Failed to create post after {} slug generation attempts for title '{}'",
            MAX_SLUG_RETRIES,
            title,
        );

        match last_error {
            Some(e) => Err(ApiError::Conflict(format!(
                "Could not generate a unique slug after {} attempts. Last error: {}",
                MAX_SLUG_RETRIES, e
            ))),
            None => Err(ApiError::InternalServerError),
        }
    }

    /// Update an existing post.
    ///
    /// ## Clearing nullable fields (fix 5.9)
    ///
    /// Nullable fields use `Option<Option<T>>`:
    /// - `None`              → field was absent from the request; keep the existing DB value
    /// - `Some(None)`        → field was explicitly set to `null`; **clear** the DB column
    /// - `Some(Some(value))` → update the DB column to the new value
    ///
    /// Non-nullable fields (`title`, `is_featured`) use plain `Option<T>`:
    /// - `None`         → keep existing
    /// - `Some(value)`  → update
    ///
    /// Instead of using SQL `COALESCE` (which cannot distinguish "not provided"
    /// from "set to null"), we resolve every column to its final value in Rust
    /// and issue a single UPDATE that sets **all** mutable columns.
    pub async fn update(
        &self,
        id: &str,
        title: Option<&str>,
        short_description: Option<Option<String>>,
        content: Option<Option<serde_json::Value>>,
        cover_image: Option<Option<String>>,
        region_id: Option<Option<String>>,
        is_featured: Option<bool>,
        event_date: Option<Option<String>>,
        event_end_date: Option<Option<String>>,
    ) -> Result<Post, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))?;

        // --- Resolve each field to its final value ---

        let final_title = title.unwrap_or(&existing.title).to_string();

        // Regenerate slug only when title changes; handle slug collision with retry loop.
        // Each call to `generate_slug` appends a random UUID fragment, so collisions
        // are extremely unlikely — but this loop guarantees correctness even under
        // high concurrency (mirrors the create-path logic).
        let final_slug = if title.is_some() {
            let mut slug_candidate = generate_slug(&final_title);
            let mut found_unique = false;

            for attempt in 0..MAX_SLUG_RETRIES {
                let conflict = sqlx::query_as::<_, (i64,)>(
                    "SELECT COUNT(*) FROM posts WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
                )
                .bind(&slug_candidate)
                .bind(id)
                .fetch_one(&self.db)
                .await?;

                if conflict.0 == 0 {
                    found_unique = true;
                    break;
                }

                tracing::warn!(
                    "Slug collision on update attempt {} for title '{}', slug '{}'. Retrying...",
                    attempt + 1,
                    final_title,
                    slug_candidate,
                );
                slug_candidate = generate_slug(&final_title);
            }

            if !found_unique {
                return Err(ApiError::Conflict(format!(
                    "Could not generate a unique slug after {} attempts",
                    MAX_SLUG_RETRIES
                )));
            }

            slug_candidate
        } else {
            existing.slug.clone()
        };

        // Resolve nullable string fields using the three-state pattern
        let final_short_description =
            resolve_nullable_string(short_description, &existing.short_description);
        let final_cover_image = resolve_nullable_string(cover_image, &existing.cover_image);
        let final_region_id = resolve_nullable_string(region_id, &existing.region_id);

        // Content: Option<Option<serde_json::Value>>
        let final_content: Option<serde_json::Value> = match content {
            None => existing.content.map(|c| c.0),
            Some(None) => None,
            Some(Some(v)) => Some(v),
        };

        let final_is_featured = is_featured.unwrap_or(existing.is_featured);

        // Date fields
        let final_event_date =
            resolve_nullable_string(event_date, &existing.event_date.map(|d| d.to_rfc3339()));
        let final_event_end_date = resolve_nullable_string(
            event_end_date,
            &existing.event_end_date.map(|d| d.to_rfc3339()),
        );

        // --- Execute a single UPDATE with all resolved values ---
        sqlx::query(
            r#"
            UPDATE posts SET
                slug = $1,
                title = $2,
                short_description = $3,
                content = $4,
                cover_image = $5,
                region_id = $6,
                is_featured = $7,
                event_date = $8::timestamptz,
                event_end_date = $9::timestamptz,
                updated_at = NOW()
            WHERE id = $10 AND deleted_at IS NULL
            "#,
        )
        .bind(&final_slug)
        .bind(&final_title)
        .bind(&final_short_description)
        .bind(&final_content)
        .bind(&final_cover_image)
        .bind(&final_region_id)
        .bind(final_is_featured)
        .bind(&final_event_date)
        .bind(&final_event_end_date)
        .bind(id)
        .execute(&self.db)
        .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;
        let _ = self
            .cache
            .delete(&format!("post:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Soft delete a post (sets deleted_at, does NOT hard delete).
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("UPDATE posts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&self.db)
            .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;
        if let Some(post) = existing {
            let _ = self.cache.delete(&format!("post:slug:{}", post.slug)).await;
        }

        Ok(())
    }

    /// Restore a soft-deleted post.
    pub async fn restore(&self, id: &str) -> Result<Post, ApiError> {
        sqlx::query("UPDATE posts SET deleted_at = NULL WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))
    }

    /// Hard delete a post permanently (admin only, for trash cleanup).
    pub async fn hard_delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id_including_deleted(id).await?;

        sqlx::query("DELETE FROM posts WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("posts:*").await;
        if let Some(post) = existing {
            let _ = self.cache.delete(&format!("post:slug:{}", post.slug)).await;
        }

        Ok(())
    }

    /// Update post status (draft/published). Sets published_at on first publish.
    pub async fn update_status(&self, id: &str, status: &str) -> Result<Post, ApiError> {
        let published_at = if status == "published" {
            Some(Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE posts SET
                status = $1::content_status,
                published_at = COALESCE($2, published_at)
            WHERE id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(status)
        .bind(published_at)
        .bind(id)
        .execute(&self.db)
        .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))
    }

    /// Update display order for featured content (admin).
    pub async fn update_display_order(
        &self,
        id: &str,
        display_order: Option<i32>,
    ) -> Result<Post, ApiError> {
        sqlx::query("UPDATE posts SET display_order = $1 WHERE id = $2 AND deleted_at IS NULL")
            .bind(display_order)
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))
    }

    /// Update featured status (admin).
    pub async fn update_featured(&self, id: &str, is_featured: bool) -> Result<Post, ApiError> {
        sqlx::query("UPDATE posts SET is_featured = $1 WHERE id = $2 AND deleted_at IS NULL")
            .bind(is_featured)
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))
    }

    /// Increment like count (called from like_service after dedup check).
    pub async fn increment_like_count(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE posts SET like_count = like_count + 1 WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    /// Decrement like count (called from like_service on unlike).
    pub async fn decrement_like_count(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    /// Increment view count (called from view_service).
    pub async fn increment_view_count(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE posts SET view_count = view_count + 1 WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    /// List soft-deleted posts (for admin trash view).
    pub async fn list_deleted(&self, page: i32, limit: i32) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let posts: Vec<Post> = sqlx::query_as(
            "SELECT * FROM posts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM posts WHERE deleted_at IS NOT NULL")
                .fetch_one(&self.db)
                .await?;

        Ok((posts, total.0))
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve a nullable string field using the three-state `Option<Option<String>>` pattern.
///
/// - `None`              → keep the existing DB value
/// - `Some(None)`        → clear (set to `None` / SQL NULL)
/// - `Some(Some(value))` → use the new value
fn resolve_nullable_string(
    input: Option<Option<String>>,
    existing: &Option<String>,
) -> Option<String> {
    match input {
        None => existing.clone(),
        Some(None) => None,
        Some(Some(v)) => Some(v),
    }
}

/// Check whether a `sqlx::Error` is a PostgreSQL unique-constraint violation (SQLSTATE 23505).
fn is_unique_violation(err: &sqlx::Error) -> bool {
    if let sqlx::Error::Database(ref db_err) = err {
        if let Some(code) = db_err.code() {
            return code.as_ref() == "23505";
        }
    }
    false
}
