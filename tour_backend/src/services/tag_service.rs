use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::tag::{ContentTag, Tag, TagWithCount},
    services::CacheService,
    utils::slug::generate_simple_slug,
};

pub struct TagService {
    db: PgPool,
    cache: CacheService,
}

impl TagService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    // =========================================================================
    // TAG CRUD
    // =========================================================================

    /// List all tags with optional type filter, ordered by name.
    pub async fn list(
        &self,
        tag_type: Option<&str>,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<Tag>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let (tags, total) = if let Some(tt) = tag_type {
            let tags: Vec<Tag> = sqlx::query_as(
                r#"
                SELECT * FROM tags
                WHERE tag_type = $1::tag_type
                ORDER BY name ASC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tt)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM tags WHERE tag_type = $1::tag_type")
                    .bind(tt)
                    .fetch_one(&self.db)
                    .await?;

            (tags, total.0)
        } else {
            let tags: Vec<Tag> = sqlx::query_as(
                r#"
                SELECT * FROM tags
                ORDER BY name ASC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tags")
                .fetch_one(&self.db)
                .await?;

            (tags, total.0)
        };

        Ok((tags, total))
    }

    /// List all tags with their usage counts (how many content items use each tag).
    pub async fn list_with_counts(
        &self,
        tag_type: Option<&str>,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<TagWithCount>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let (tags, total) = if let Some(tt) = tag_type {
            let tags: Vec<TagWithCount> = sqlx::query_as(
                r#"
                SELECT t.id, t.name, t.slug, t.tag_type, t.created_at,
                       COUNT(ct.id) AS usage_count
                FROM tags t
                LEFT JOIN content_tags ct ON ct.tag_id = t.id
                WHERE t.tag_type = $1::tag_type
                GROUP BY t.id, t.name, t.slug, t.tag_type, t.created_at
                ORDER BY t.name ASC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tt)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM tags WHERE tag_type = $1::tag_type")
                    .bind(tt)
                    .fetch_one(&self.db)
                    .await?;

            (tags, total.0)
        } else {
            let tags: Vec<TagWithCount> = sqlx::query_as(
                r#"
                SELECT t.id, t.name, t.slug, t.tag_type, t.created_at,
                       COUNT(ct.id) AS usage_count
                FROM tags t
                LEFT JOIN content_tags ct ON ct.tag_id = t.id
                GROUP BY t.id, t.name, t.slug, t.tag_type, t.created_at
                ORDER BY t.name ASC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tags")
                .fetch_one(&self.db)
                .await?;

            (tags, total.0)
        };

        Ok((tags, total))
    }

    /// Get a tag by ID.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<Tag>, ApiError> {
        let tag = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(tag)
    }

    /// Get a tag by slug.
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Tag>, ApiError> {
        let tag = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE slug = $1")
            .bind(slug)
            .fetch_optional(&self.db)
            .await?;

        Ok(tag)
    }

    /// Get a tag by name (exact match, case-insensitive).
    pub async fn get_by_name(&self, name: &str) -> Result<Option<Tag>, ApiError> {
        let tag = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE LOWER(name) = LOWER($1)")
            .bind(name)
            .fetch_optional(&self.db)
            .await?;

        Ok(tag)
    }

    /// Create a new tag. Returns an error if a tag with the same name already exists.
    pub async fn create(&self, name: &str, tag_type: &str) -> Result<Tag, ApiError> {
        // Check for duplicate name
        if self.get_by_name(name).await?.is_some() {
            return Err(ApiError::Conflict(format!(
                "Tag with name '{}' already exists",
                name
            )));
        }

        let id = Uuid::new_v4().to_string();
        let slug = generate_simple_slug(name);

        // Check for duplicate slug
        if self.get_by_slug(&slug).await?.is_some() {
            // Append a short UUID suffix to make it unique
            let unique_slug = format!("{}-{}", slug, &Uuid::new_v4().to_string()[..6]);
            sqlx::query(
                r#"
                INSERT INTO tags (id, name, slug, tag_type, created_at)
                VALUES ($1, $2, $3, $4::tag_type, NOW())
                "#,
            )
            .bind(&id)
            .bind(name)
            .bind(&unique_slug)
            .bind(tag_type)
            .execute(&self.db)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO tags (id, name, slug, tag_type, created_at)
                VALUES ($1, $2, $3, $4::tag_type, NOW())
                "#,
            )
            .bind(&id)
            .bind(name)
            .bind(&slug)
            .bind(tag_type)
            .execute(&self.db)
            .await?;
        }

        let _ = self.cache.invalidate("tags:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update a tag's name and/or type. Regenerates slug if name changes.
    pub async fn update(
        &self,
        id: &str,
        name: Option<&str>,
        tag_type: Option<&str>,
    ) -> Result<Tag, ApiError> {
        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Tag not found".to_string()))?;

        // If renaming, check for duplicates
        if let Some(new_name) = name {
            if let Some(existing) = self.get_by_name(new_name).await? {
                if existing.id != id {
                    return Err(ApiError::Conflict(format!(
                        "Tag with name '{}' already exists",
                        new_name
                    )));
                }
            }
        }

        let new_slug = name.map(generate_simple_slug);

        sqlx::query(
            r#"
            UPDATE tags SET
                name = COALESCE($1, name),
                slug = COALESCE($2, slug),
                tag_type = COALESCE($3::tag_type, tag_type)
            WHERE id = $4
            "#,
        )
        .bind(name)
        .bind(new_slug)
        .bind(tag_type)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("tags:*").await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Delete a tag and all its content_tags associations (CASCADE handles this).
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM tags WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("tags:*").await;

        Ok(())
    }

    // =========================================================================
    // CONTENT TAG ASSOCIATIONS
    // =========================================================================

    /// Get all tags for a specific content item.
    pub async fn get_tags_for_content(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<Vec<Tag>, ApiError> {
        let tags: Vec<Tag> = sqlx::query_as(
            r#"
            SELECT t.* FROM tags t
            INNER JOIN content_tags ct ON ct.tag_id = t.id
            WHERE ct.target_type = $1::content_tag_target
              AND ct.target_id = $2
            ORDER BY t.name ASC
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_all(&self.db)
        .await?;

        Ok(tags)
    }

    /// Get all content_tag records for a specific content item.
    pub async fn get_content_tags(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<Vec<ContentTag>, ApiError> {
        let content_tags: Vec<ContentTag> = sqlx::query_as(
            r#"
            SELECT * FROM content_tags
            WHERE target_type = $1::content_tag_target
              AND target_id = $2
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_all(&self.db)
        .await?;

        Ok(content_tags)
    }

    /// Add a tag to a content item. Silently ignores duplicates (UNIQUE constraint).
    pub async fn add_tag_to_content(
        &self,
        tag_id: &str,
        target_type: &str,
        target_id: &str,
    ) -> Result<ContentTag, ApiError> {
        // Verify the tag exists
        self.get_by_id(tag_id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Tag not found".to_string()))?;

        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO content_tags (id, tag_id, target_type, target_id)
            VALUES ($1, $2, $3::content_tag_target, $4)
            ON CONFLICT (tag_id, target_type, target_id) DO NOTHING
            "#,
        )
        .bind(&id)
        .bind(tag_id)
        .bind(target_type)
        .bind(target_id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("tags:*").await;

        // Fetch the content_tag (could be the new one or the existing one)
        let ct = sqlx::query_as::<_, ContentTag>(
            r#"
            SELECT * FROM content_tags
            WHERE tag_id = $1
              AND target_type = $2::content_tag_target
              AND target_id = $3
            "#,
        )
        .bind(tag_id)
        .bind(target_type)
        .bind(target_id)
        .fetch_one(&self.db)
        .await?;

        Ok(ct)
    }

    /// Remove a tag from a content item.
    pub async fn remove_tag_from_content(
        &self,
        tag_id: &str,
        target_type: &str,
        target_id: &str,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            DELETE FROM content_tags
            WHERE tag_id = $1
              AND target_type = $2::content_tag_target
              AND target_id = $3
            "#,
        )
        .bind(tag_id)
        .bind(target_type)
        .bind(target_id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("tags:*").await;

        Ok(())
    }

    /// Replace all tags for a content item with a new set.
    /// This is an atomic operation: removes all existing tags and adds the new ones.
    pub async fn set_tags_for_content(
        &self,
        target_type: &str,
        target_id: &str,
        tag_ids: &[String],
    ) -> Result<Vec<Tag>, ApiError> {
        // Remove all existing tags for this content
        sqlx::query(
            r#"
            DELETE FROM content_tags
            WHERE target_type = $1::content_tag_target
              AND target_id = $2
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .execute(&self.db)
        .await?;

        // Add new tags
        for tag_id in tag_ids {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO content_tags (id, tag_id, target_type, target_id)
                VALUES ($1, $2, $3::content_tag_target, $4)
                ON CONFLICT (tag_id, target_type, target_id) DO NOTHING
                "#,
            )
            .bind(&id)
            .bind(tag_id)
            .bind(target_type)
            .bind(target_id)
            .execute(&self.db)
            .await?;
        }

        let _ = self.cache.invalidate("tags:*").await;

        // Return the updated tag list
        self.get_tags_for_content(target_type, target_id).await
    }

    /// Find or create tags by name. Useful for tagging flows where the user
    /// types tag names and they should be created if they don't exist.
    /// Returns the tag IDs.
    pub async fn find_or_create_by_names(
        &self,
        names: &[String],
        tag_type: &str,
    ) -> Result<Vec<Tag>, ApiError> {
        let mut tags = Vec::with_capacity(names.len());

        for name in names {
            let trimmed = name.trim();
            if trimmed.is_empty() {
                continue;
            }

            let tag = match self.get_by_name(trimmed).await? {
                Some(existing) => existing,
                None => self.create(trimmed, tag_type).await?,
            };

            tags.push(tag);
        }

        Ok(tags)
    }

    /// Get content items that have a specific tag.
    /// Returns (target_type, target_id) pairs.
    pub async fn get_content_by_tag(
        &self,
        tag_id: &str,
        target_type: Option<&str>,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<ContentTag>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let (items, total) = if let Some(tt) = target_type {
            let items: Vec<ContentTag> = sqlx::query_as(
                r#"
                SELECT * FROM content_tags
                WHERE tag_id = $1
                  AND target_type = $2::content_tag_target
                ORDER BY id ASC
                LIMIT $3 OFFSET $4
                "#,
            )
            .bind(tag_id)
            .bind(tt)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM content_tags WHERE tag_id = $1 AND target_type = $2::content_tag_target",
            )
            .bind(tag_id)
            .bind(tt)
            .fetch_one(&self.db)
            .await?;

            (items, total.0)
        } else {
            let items: Vec<ContentTag> = sqlx::query_as(
                r#"
                SELECT * FROM content_tags
                WHERE tag_id = $1
                ORDER BY id ASC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(tag_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.db)
            .await?;

            let total: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM content_tags WHERE tag_id = $1")
                    .bind(tag_id)
                    .fetch_one(&self.db)
                    .await?;

            (items, total.0)
        };

        Ok((items, total))
    }

    /// Count total tags.
    pub async fn count(&self) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tags")
            .fetch_one(&self.db)
            .await?;
        Ok(count)
    }

    /// Search tags by name prefix (for autocomplete/typeahead).
    pub async fn search(&self, query: &str, limit: i32) -> Result<Vec<Tag>, ApiError> {
        let pattern = format!("{}%", query.to_lowercase());
        let tags: Vec<Tag> = sqlx::query_as(
            r#"
            SELECT * FROM tags
            WHERE LOWER(name) LIKE $1
            ORDER BY name ASC
            LIMIT $2
            "#,
        )
        .bind(&pattern)
        .bind(limit as i64)
        .fetch_all(&self.db)
        .await?;

        Ok(tags)
    }
}
