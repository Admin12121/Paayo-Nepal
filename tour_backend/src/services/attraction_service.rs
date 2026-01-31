use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::attractions::UpdateAttractionInput, models::attraction::Attraction,
    services::CacheService, utils::slug::generate_slug,
};

pub struct AttractionService {
    db: MySqlPool,
    cache: CacheService,
}

impl AttractionService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        region_id: Option<&str>,
        is_top: Option<bool>,
    ) -> Result<(Vec<Attraction>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut query = String::from("SELECT * FROM attractions WHERE 1=1");
        let mut count_query = String::from("SELECT COUNT(*) FROM attractions WHERE 1=1");

        if region_id.is_some() {
            query.push_str(" AND region_id = ?");
            count_query.push_str(" AND region_id = ?");
        }

        if is_top.is_some() {
            query.push_str(" AND is_top_attraction = ?");
            count_query.push_str(" AND is_top_attraction = ?");
        }

        query.push_str(" ORDER BY is_top_attraction DESC, views DESC LIMIT ? OFFSET ?");

        // Build and execute the data query
        let mut data_q = sqlx::query_as::<_, Attraction>(&query);
        if let Some(rid) = region_id {
            data_q = data_q.bind(rid);
        }
        if let Some(top) = is_top {
            data_q = data_q.bind(top);
        }
        data_q = data_q.bind(limit).bind(offset);
        let attractions: Vec<Attraction> = data_q.fetch_all(&self.db).await?;

        // Build and execute the count query
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_query);
        if let Some(rid) = region_id {
            count_q = count_q.bind(rid);
        }
        if let Some(top) = is_top {
            count_q = count_q.bind(top);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((attractions, total.0))
    }

    pub async fn top(&self, page: i32, limit: i32) -> Result<(Vec<Attraction>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let attractions: Vec<Attraction> = sqlx::query_as(
            "SELECT * FROM attractions WHERE is_top_attraction = true ORDER BY views DESC LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM attractions WHERE is_top_attraction = true")
                .fetch_one(&self.db)
                .await?;

        Ok((attractions, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Attraction>, ApiError> {
        let attraction =
            sqlx::query_as::<_, Attraction>("SELECT * FROM attractions WHERE slug = ?")
                .bind(slug)
                .fetch_optional(&self.db)
                .await?;

        Ok(attraction)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Attraction>, ApiError> {
        let attraction = sqlx::query_as::<_, Attraction>("SELECT * FROM attractions WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(attraction)
    }

    pub async fn create(
        &self,
        name: &str,
        description: Option<&str>,
        content: Option<&str>,
        featured_image: Option<&str>,
        region_id: Option<&str>,
        latitude: Option<f64>,
        longitude: Option<f64>,
        address: Option<&str>,
        opening_hours: Option<&serde_json::Value>,
        entry_fee: Option<&str>,
        is_top_attraction: bool,
        created_by: &str,
    ) -> Result<Attraction, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(name);
        let opening_hours_json =
            opening_hours.map(|h| serde_json::to_string(h).unwrap_or_default());

        sqlx::query(
            r#"
            INSERT INTO attractions (id, slug, name, description, content, featured_image, region_id, latitude, longitude, address, opening_hours, entry_fee, is_top_attraction, views, review_count, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(&slug)
        .bind(name)
        .bind(description)
        .bind(content)
        .bind(featured_image)
        .bind(region_id)
        .bind(latitude)
        .bind(longitude)
        .bind(address)
        .bind(&opening_hours_json)
        .bind(entry_fee)
        .bind(is_top_attraction)
        .bind(created_by)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("attractions:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn update(
        &self,
        id: &str,
        input: UpdateAttractionInput,
    ) -> Result<Attraction, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Attraction not found".to_string()))?;

        let new_slug = input.name.as_ref().map(|n| generate_slug(n));
        let opening_hours_json = input
            .opening_hours
            .as_ref()
            .map(|h| serde_json::to_string(h).unwrap_or_default());

        sqlx::query(
            r#"
            UPDATE attractions SET
                slug = COALESCE(?, slug),
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                content = COALESCE(?, content),
                featured_image = COALESCE(?, featured_image),
                region_id = COALESCE(?, region_id),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                address = COALESCE(?, address),
                opening_hours = COALESCE(?, opening_hours),
                entry_fee = COALESCE(?, entry_fee),
                is_top_attraction = COALESCE(?, is_top_attraction),
                updated_at = NOW()
            WHERE id = ?
            "#,
        )
        .bind(new_slug)
        .bind(input.name)
        .bind(input.description)
        .bind(input.content)
        .bind(input.featured_image)
        .bind(input.region_id)
        .bind(input.latitude)
        .bind(input.longitude)
        .bind(input.address)
        .bind(&opening_hours_json)
        .bind(input.entry_fee)
        .bind(input.is_top_attraction)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("attractions:*").await;
        let _ = self
            .cache
            .delete(&format!("attraction:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("DELETE FROM attractions WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("attractions:*").await;
        if let Some(attraction) = existing {
            let _ = self
                .cache
                .delete(&format!("attraction:slug:{}", attraction.slug))
                .await;
        }

        Ok(())
    }
}
