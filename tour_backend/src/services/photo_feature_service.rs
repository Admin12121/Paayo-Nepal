use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::photo_feature::{PhotoFeature, PhotoFeatureWithImages, PhotoImage},
    services::CacheService,
    utils::slug::generate_slug,
};

/// Maximum slug generation attempts before returning a conflict error.
const MAX_SLUG_RETRIES: usize = 5;

pub struct PhotoFeatureService {
    db: PgPool,
    cache: CacheService,
}

impl PhotoFeatureService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    // ─── List ────────────────────────────────────────────────────────────────

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        status: Option<&str>,
        region_id: Option<&str>,
        is_featured: Option<bool>,
    ) -> Result<(Vec<PhotoFeature>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut where_clauses = vec!["deleted_at IS NULL".to_string()];
        let mut param_idx: usize = 0;
        let mut bind_values: Vec<String> = Vec::new();

        if let Some(s) = status {
            param_idx += 1;
            where_clauses.push(format!("status = ${}::content_status", param_idx));
            bind_values.push(s.to_string());
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

        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;
        let data_sql = format!(
            "SELECT * FROM photo_features WHERE {} ORDER BY display_order ASC NULLS LAST, created_at DESC LIMIT ${} OFFSET ${}",
            where_sql, limit_idx, offset_idx
        );
        let count_sql = format!("SELECT COUNT(*) FROM photo_features WHERE {}", where_sql);

        let mut data_q = sqlx::query_as::<_, PhotoFeature>(&data_sql);
        for b in &bind_values {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit as i64).bind(offset as i64);
        let features: Vec<PhotoFeature> = data_q.fetch_all(&self.db).await?;

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &bind_values {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((features, total.0))
    }

    // ─── Get by slug / id ────────────────────────────────────────────────────

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<PhotoFeature>, ApiError> {
        let feature = sqlx::query_as::<_, PhotoFeature>(
            "SELECT * FROM photo_features WHERE slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(feature)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<PhotoFeature>, ApiError> {
        let feature = sqlx::query_as::<_, PhotoFeature>(
            "SELECT * FROM photo_features WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(feature)
    }

    /// Get a photo feature with all its images.
    pub async fn get_with_images(
        &self,
        id: &str,
    ) -> Result<Option<PhotoFeatureWithImages>, ApiError> {
        let feature = match self.get_by_id(id).await? {
            Some(f) => f,
            None => return Ok(None),
        };

        let images = self.list_images(id).await?;

        Ok(Some(PhotoFeatureWithImages::from_feature_and_images(
            feature, images,
        )))
    }

    /// Get a photo feature with images by slug.
    pub async fn get_with_images_by_slug(
        &self,
        slug: &str,
    ) -> Result<Option<PhotoFeatureWithImages>, ApiError> {
        let feature = match self.get_by_slug(slug).await? {
            Some(f) => f,
            None => return Ok(None),
        };

        let images = self.list_images(&feature.id).await?;

        Ok(Some(PhotoFeatureWithImages::from_feature_and_images(
            feature, images,
        )))
    }

    // ─── Create ──────────────────────────────────────────────────────────────

    pub async fn create(
        &self,
        author_id: &str,
        title: &str,
        description: Option<&str>,
        region_id: Option<&str>,
        is_featured: bool,
    ) -> Result<PhotoFeature, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);

        sqlx::query(
            r#"
            INSERT INTO photo_features (
                id, author_id, title, slug, description,
                region_id, is_featured, status,
                like_count, view_count, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, 'draft',
                0, 0, NOW(), NOW()
            )
            "#,
        )
        .bind(&id)
        .bind(author_id)
        .bind(title)
        .bind(&slug)
        .bind(description)
        .bind(region_id)
        .bind(is_featured)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("photos:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    pub async fn update(
        &self,
        id: &str,
        title: Option<&str>,
        description: Option<&str>,
        region_id: Option<&str>,
        is_featured: Option<bool>,
        status: Option<&str>,
    ) -> Result<PhotoFeature, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))?;

        // Generate a unique slug when title changes, with collision retry loop.
        let new_slug = if let Some(t) = title {
            let mut slug_candidate = generate_slug(t);
            let mut found_unique = false;

            for attempt in 0..MAX_SLUG_RETRIES {
                let conflict = sqlx::query_as::<_, (i64,)>(
                    "SELECT COUNT(*) FROM photo_features WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
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
                    "Slug collision on photo_feature update attempt {} for title '{}', slug '{}'. Retrying...",
                    attempt + 1,
                    t,
                    slug_candidate,
                );
                slug_candidate = generate_slug(t);
            }

            if !found_unique {
                return Err(ApiError::Conflict(format!(
                    "Could not generate a unique slug after {} attempts",
                    MAX_SLUG_RETRIES
                )));
            }

            Some(slug_candidate)
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE photo_features SET
                slug = COALESCE($1, slug),
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                region_id = COALESCE($4, region_id),
                is_featured = COALESCE($5, is_featured),
                status = COALESCE($6::content_status, status)
            WHERE id = $7 AND deleted_at IS NULL
            "#,
        )
        .bind(new_slug.as_deref())
        .bind(title)
        .bind(description)
        .bind(region_id)
        .bind(is_featured)
        .bind(status)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("photos:*").await;
        let _ = self
            .cache
            .delete(&format!("photo:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update status (draft / published). Sets published_at on first publish.
    pub async fn update_status(&self, id: &str, status: &str) -> Result<PhotoFeature, ApiError> {
        let published_at = if status == "published" {
            Some(chrono::Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE photo_features SET
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

        let _ = self.cache.invalidate("photos:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))
    }

    // ─── Delete / Restore ────────────────────────────────────────────────────

    /// Soft delete a photo feature (images cascade).
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query(
            "UPDATE photo_features SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("photos:*").await;
        if let Some(f) = existing {
            let _ = self.cache.delete(&format!("photo:slug:{}", f.slug)).await;
        }

        Ok(())
    }

    /// Restore a soft-deleted photo feature.
    pub async fn restore(&self, id: &str) -> Result<PhotoFeature, ApiError> {
        sqlx::query("UPDATE photo_features SET deleted_at = NULL WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("photos:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))
    }

    /// Hard delete a photo feature permanently (admin only). Images cascade.
    pub async fn hard_delete(&self, id: &str) -> Result<(), ApiError> {
        // photo_images has ON DELETE CASCADE, so they will be removed automatically
        sqlx::query("DELETE FROM photo_features WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("photos:*").await;
        Ok(())
    }

    // ─── Photo Images (child table) ──────────────────────────────────────────

    /// List images belonging to a photo feature, ordered by display_order.
    pub async fn list_images(&self, photo_feature_id: &str) -> Result<Vec<PhotoImage>, ApiError> {
        let images: Vec<PhotoImage> = sqlx::query_as(
            r#"
            SELECT * FROM photo_images
            WHERE photo_feature_id = $1
            ORDER BY display_order ASC NULLS LAST, created_at ASC
            "#,
        )
        .bind(photo_feature_id)
        .fetch_all(&self.db)
        .await?;

        Ok(images)
    }

    /// Add an image to a photo feature.
    pub async fn add_image(
        &self,
        photo_feature_id: &str,
        uploaded_by: Option<&str>,
        image_url: &str,
        caption: Option<&str>,
        display_order: Option<i32>,
    ) -> Result<PhotoImage, ApiError> {
        // Verify the parent exists
        self.get_by_id(photo_feature_id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))?;

        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO photo_images (id, photo_feature_id, uploaded_by, image_url, caption, display_order, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            "#,
        )
        .bind(&id)
        .bind(photo_feature_id)
        .bind(uploaded_by)
        .bind(image_url)
        .bind(caption)
        .bind(display_order)
        .execute(&self.db)
        .await?;

        let image = sqlx::query_as::<_, PhotoImage>("SELECT * FROM photo_images WHERE id = $1")
            .bind(&id)
            .fetch_one(&self.db)
            .await?;

        Ok(image)
    }

    /// Update an image's caption or display order.
    pub async fn update_image(
        &self,
        image_id: &str,
        caption: Option<&str>,
        display_order: Option<i32>,
    ) -> Result<PhotoImage, ApiError> {
        sqlx::query(
            r#"
            UPDATE photo_images SET
                caption = COALESCE($1, caption),
                display_order = COALESCE($2, display_order)
            WHERE id = $3
            "#,
        )
        .bind(caption)
        .bind(display_order)
        .bind(image_id)
        .execute(&self.db)
        .await?;

        let image = sqlx::query_as::<_, PhotoImage>("SELECT * FROM photo_images WHERE id = $1")
            .bind(image_id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("Photo image not found".to_string()))?;

        Ok(image)
    }

    /// Remove an image from a photo feature.
    pub async fn remove_image(&self, image_id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM photo_images WHERE id = $1")
            .bind(image_id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    /// Reorder images within a photo feature.
    /// Accepts a list of image IDs in the desired order.
    pub async fn reorder_images(
        &self,
        photo_feature_id: &str,
        image_ids: &[String],
    ) -> Result<(), ApiError> {
        for (idx, image_id) in image_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE photo_images SET display_order = $1 WHERE id = $2 AND photo_feature_id = $3",
            )
            .bind(idx as i32)
            .bind(image_id)
            .bind(photo_feature_id)
            .execute(&self.db)
            .await?;
        }

        Ok(())
    }

    /// Batch add images to a photo feature (used during creation).
    pub async fn batch_add_images(
        &self,
        photo_feature_id: &str,
        images: &[(String, Option<String>)], // (image_url, caption)
    ) -> Result<Vec<PhotoImage>, ApiError> {
        let mut result = Vec::new();

        for (idx, (url, caption)) in images.iter().enumerate() {
            let image = self
                .add_image(
                    photo_feature_id,
                    None,
                    url,
                    caption.as_deref(),
                    Some(idx as i32),
                )
                .await?;
            result.push(image);
        }

        Ok(result)
    }

    /// Count images in a photo feature.
    pub async fn count_images(&self, photo_feature_id: &str) -> Result<i64, ApiError> {
        let (count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM photo_images WHERE photo_feature_id = $1")
                .bind(photo_feature_id)
                .fetch_one(&self.db)
                .await?;

        Ok(count)
    }

    // ─── Display Order ───────────────────────────────────────────────────────

    /// Update display order for a photo feature (admin).
    pub async fn update_display_order(
        &self,
        id: &str,
        display_order: Option<i32>,
    ) -> Result<PhotoFeature, ApiError> {
        sqlx::query(
            "UPDATE photo_features SET display_order = $1 WHERE id = $2 AND deleted_at IS NULL",
        )
        .bind(display_order)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("photos:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Photo feature not found".to_string()))
    }

    // ─── Trash ───────────────────────────────────────────────────────────────

    /// List soft-deleted photo features (for admin trash view).
    pub async fn list_deleted(
        &self,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<PhotoFeature>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let features: Vec<PhotoFeature> = sqlx::query_as(
            r#"
            SELECT * FROM photo_features
            WHERE deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM photo_features WHERE deleted_at IS NOT NULL")
                .fetch_one(&self.db)
                .await?;

        Ok((features, total.0))
    }
}
