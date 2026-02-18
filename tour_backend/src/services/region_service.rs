use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::regions::UpdateRegionInput, models::region::Region,
    services::CacheService, utils::slug::generate_slug,
};

/// Maximum slug generation attempts before returning a conflict error.
const MAX_SLUG_RETRIES: usize = 5;

pub struct RegionService {
    db: PgPool,
    cache: CacheService,
}

impl RegionService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        status: Option<&str>,
        province: Option<&str>,
    ) -> Result<(Vec<Region>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let regions: Vec<Region> = match (status, province) {
            (Some(s), Some(p)) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM regions
                    WHERE status = $1::content_status
                      AND province = $2
                      AND deleted_at IS NULL
                    ORDER BY attraction_rank ASC NULLS LAST, name ASC
                    LIMIT $3 OFFSET $4
                    "#,
                )
                .bind(s)
                .bind(p)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&self.db)
                .await?
            }
            (Some(s), None) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM regions
                    WHERE status = $1::content_status
                      AND deleted_at IS NULL
                    ORDER BY attraction_rank ASC NULLS LAST, name ASC
                    LIMIT $2 OFFSET $3
                    "#,
                )
                .bind(s)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&self.db)
                .await?
            }
            (None, Some(p)) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM regions
                    WHERE province = $1
                      AND deleted_at IS NULL
                    ORDER BY attraction_rank ASC NULLS LAST, name ASC
                    LIMIT $2 OFFSET $3
                    "#,
                )
                .bind(p)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&self.db)
                .await?
            }
            (None, None) => {
                sqlx::query_as(
                    r#"
                    SELECT * FROM regions
                    WHERE deleted_at IS NULL
                    ORDER BY attraction_rank ASC NULLS LAST, name ASC
                    LIMIT $1 OFFSET $2
                    "#,
                )
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&self.db)
                .await?
            }
        };

        let total: (i64,) = match (status, province) {
            (Some(s), Some(p)) => {
                sqlx::query_as(
                    r#"
                    SELECT COUNT(*)
                    FROM regions
                    WHERE status = $1::content_status
                      AND province = $2
                      AND deleted_at IS NULL
                    "#,
                )
                .bind(s)
                .bind(p)
                .fetch_one(&self.db)
                .await?
            }
            (Some(s), None) => {
                sqlx::query_as(
                    "SELECT COUNT(*) FROM regions WHERE status = $1::content_status AND deleted_at IS NULL",
                )
                .bind(s)
                .fetch_one(&self.db)
                .await?
            }
            (None, Some(p)) => {
                sqlx::query_as(
                    "SELECT COUNT(*) FROM regions WHERE province = $1 AND deleted_at IS NULL",
                )
                .bind(p)
                .fetch_one(&self.db)
                .await?
            }
            (None, None) => {
                sqlx::query_as("SELECT COUNT(*) FROM regions WHERE deleted_at IS NULL")
                    .fetch_one(&self.db)
                    .await?
            }
        };

        Ok((regions, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Region>, ApiError> {
        let region = sqlx::query_as::<_, Region>(
            "SELECT * FROM regions WHERE slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(region)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Region>, ApiError> {
        let region = sqlx::query_as::<_, Region>(
            "SELECT * FROM regions WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(region)
    }

    pub async fn create(
        &self,
        author_id: &str,
        name: &str,
        description: Option<&str>,
        cover_image: Option<&str>,
        is_featured: bool,
        province: Option<&str>,
        district: Option<&str>,
        latitude: Option<f64>,
        longitude: Option<f64>,
        map_data: Option<serde_json::Value>,
    ) -> Result<Region, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(name);

        sqlx::query(
            r#"
            INSERT INTO regions (
                id, author_id, name, slug, description, cover_image,
                is_featured, province, district, latitude, longitude, map_data,
                status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', NOW(), NOW())
            "#,
        )
        .bind(&id)
        .bind(author_id)
        .bind(name)
        .bind(&slug)
        .bind(description)
        .bind(cover_image)
        .bind(is_featured)
        .bind(province)
        .bind(district)
        .bind(latitude)
        .bind(longitude)
        .bind(map_data.map(sqlx::types::Json))
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("regions:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateRegionInput) -> Result<Region, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Region not found".to_string()))?;

        // Generate a unique slug when name changes, with collision retry loop.
        let new_slug = if let Some(ref name) = input.name {
            let mut slug_candidate = generate_slug(name);
            let mut found_unique = false;

            for attempt in 0..MAX_SLUG_RETRIES {
                let conflict = sqlx::query_as::<_, (i64,)>(
                    "SELECT COUNT(*) FROM regions WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
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
                    "Slug collision on region update attempt {} for name '{}', slug '{}'. Retrying...",
                    attempt + 1,
                    name,
                    slug_candidate,
                );
                slug_candidate = generate_slug(name);
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
            UPDATE regions SET
                slug = COALESCE($1, slug),
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                cover_image = COALESCE($4, cover_image),
                is_featured = COALESCE($5, is_featured),
                status = COALESCE($6::content_status, status),
                province = COALESCE($7, province),
                district = COALESCE($8, district),
                latitude = COALESCE($9, latitude),
                longitude = COALESCE($10, longitude),
                map_data = $11
            WHERE id = $12 AND deleted_at IS NULL
            "#,
        )
        .bind(new_slug.as_deref())
        .bind(input.name)
        .bind(input.description)
        .bind(input.cover_image)
        .bind(input.is_featured)
        .bind(input.status)
        .bind(input.province)
        .bind(input.district)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.map_data.map(sqlx::types::Json))
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("regions:*").await;
        let _ = self
            .cache
            .delete(&format!("region:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        // Soft delete
        sqlx::query("UPDATE regions SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("regions:*").await;
        if let Some(region) = existing {
            let _ = self
                .cache
                .delete(&format!("region:slug:{}", region.slug))
                .await;
        }

        Ok(())
    }

    /// Restore a soft-deleted region.
    pub async fn restore(&self, id: &str) -> Result<Region, ApiError> {
        sqlx::query("UPDATE regions SET deleted_at = NULL WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("regions:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Region not found".to_string()))
    }

    /// Update attraction rank for a region (admin).
    pub async fn update_rank(
        &self,
        id: &str,
        attraction_rank: Option<i32>,
    ) -> Result<Region, ApiError> {
        sqlx::query("UPDATE regions SET attraction_rank = $1 WHERE id = $2 AND deleted_at IS NULL")
            .bind(attraction_rank)
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("regions:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Region not found".to_string()))
    }

    /// Get top-ranked regions (public).
    pub async fn top_attractions(&self, limit: i32) -> Result<Vec<Region>, ApiError> {
        let regions: Vec<Region> = sqlx::query_as(
            r#"
            SELECT * FROM regions
            WHERE deleted_at IS NULL
              AND status = 'published'
              AND attraction_rank IS NOT NULL
            ORDER BY attraction_rank ASC
            LIMIT $1
            "#,
        )
        .bind(limit as i64)
        .fetch_all(&self.db)
        .await?;

        Ok(regions)
    }
}
