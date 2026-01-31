use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    handlers::regions::UpdateRegionInput,
    models::{attraction::Attraction, region::Region},
    services::CacheService,
    utils::slug::generate_slug,
};

pub struct RegionService {
    db: MySqlPool,
    cache: CacheService,
}

impl RegionService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        province: Option<&str>,
    ) -> Result<(Vec<Region>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let regions: Vec<Region> = if let Some(p) = province {
            sqlx::query_as(
                "SELECT * FROM regions WHERE province = ? ORDER BY display_order ASC, name ASC LIMIT ? OFFSET ?"
            )
            .bind(p)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                "SELECT * FROM regions ORDER BY display_order ASC, name ASC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(p) = province {
            sqlx::query_as("SELECT COUNT(*) FROM regions WHERE province = ?")
                .bind(p)
                .fetch_one(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM regions")
                .fetch_one(&self.db)
                .await?
        };

        Ok((regions, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Region>, ApiError> {
        let region = sqlx::query_as::<_, Region>("SELECT * FROM regions WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.db)
            .await?;

        Ok(region)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Region>, ApiError> {
        let region = sqlx::query_as::<_, Region>("SELECT * FROM regions WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(region)
    }

    pub async fn get_attractions(
        &self,
        region_id: &str,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<Attraction>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let attractions: Vec<Attraction> = sqlx::query_as(
            "SELECT * FROM attractions WHERE region_id = ? ORDER BY is_top_attraction DESC, views DESC LIMIT ? OFFSET ?"
        )
        .bind(region_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM attractions WHERE region_id = ?")
            .bind(region_id)
            .fetch_one(&self.db)
            .await?;

        Ok((attractions, total.0))
    }

    pub async fn create(
        &self,
        name: &str,
        description: Option<&str>,
        featured_image: Option<&str>,
        latitude: Option<f64>,
        longitude: Option<f64>,
        province: Option<&str>,
        district: Option<&str>,
        display_order: Option<i32>,
        created_by: &str,
    ) -> Result<Region, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(name);

        sqlx::query(
            r#"
            INSERT INTO regions (id, slug, name, description, featured_image, latitude, longitude, province, district, display_order, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(&slug)
        .bind(name)
        .bind(description)
        .bind(featured_image)
        .bind(latitude)
        .bind(longitude)
        .bind(province)
        .bind(district)
        .bind(display_order.unwrap_or(0))
        .bind(created_by)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("regions:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateRegionInput) -> Result<Region, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Region not found".to_string()))?;

        let new_slug = input.name.as_ref().map(|n| generate_slug(n));

        sqlx::query(
            r#"
            UPDATE regions SET
                slug = COALESCE(?, slug),
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                featured_image = COALESCE(?, featured_image),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                province = COALESCE(?, province),
                district = COALESCE(?, district),
                display_order = COALESCE(?, display_order),
                updated_at = NOW()
            WHERE id = ?
            "#,
        )
        .bind(new_slug)
        .bind(input.name)
        .bind(input.description)
        .bind(input.featured_image)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.province)
        .bind(input.district)
        .bind(input.display_order)
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
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("DELETE FROM regions WHERE id = ?")
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
}
