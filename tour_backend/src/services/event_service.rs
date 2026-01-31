use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::events::UpdateEventInput, models::event::Event,
    services::CacheService, utils::slug::generate_slug,
};

pub struct EventService {
    db: MySqlPool,
    cache: CacheService,
}

impl EventService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        region_id: Option<&str>,
        featured: Option<bool>,
    ) -> Result<(Vec<Event>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut query = String::from("SELECT * FROM events WHERE 1=1");
        let mut count_query = String::from("SELECT COUNT(*) FROM events WHERE 1=1");

        if region_id.is_some() {
            query.push_str(" AND region_id = ?");
            count_query.push_str(" AND region_id = ?");
        }

        if featured.is_some() {
            query.push_str(" AND is_featured = ?");
            count_query.push_str(" AND is_featured = ?");
        }

        query.push_str(" ORDER BY start_date ASC LIMIT ? OFFSET ?");

        // Build and execute the data query
        let mut data_q = sqlx::query_as::<_, Event>(&query);
        if let Some(rid) = region_id {
            data_q = data_q.bind(rid);
        }
        if let Some(f) = featured {
            data_q = data_q.bind(f);
        }
        data_q = data_q.bind(limit).bind(offset);
        let events: Vec<Event> = data_q.fetch_all(&self.db).await?;

        // Build and execute the count query
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_query);
        if let Some(rid) = region_id {
            count_q = count_q.bind(rid);
        }
        if let Some(f) = featured {
            count_q = count_q.bind(f);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((events, total.0))
    }

    pub async fn upcoming(&self, page: i32, limit: i32) -> Result<(Vec<Event>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let events: Vec<Event> = sqlx::query_as(
            "SELECT * FROM events WHERE start_date >= CURDATE() ORDER BY start_date ASC LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM events WHERE start_date >= CURDATE()")
                .fetch_one(&self.db)
                .await?;

        Ok((events, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Event>, ApiError> {
        let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.db)
            .await?;

        Ok(event)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Event>, ApiError> {
        let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(event)
    }

    pub async fn create(
        &self,
        title: &str,
        description: Option<&str>,
        content: Option<&str>,
        featured_image: Option<&str>,
        start_date: &str,
        end_date: Option<&str>,
        start_time: Option<&str>,
        end_time: Option<&str>,
        location: Option<&str>,
        region_id: Option<&str>,
        is_featured: bool,
        created_by: &str,
    ) -> Result<Event, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);

        sqlx::query(
            r#"
            INSERT INTO events (id, slug, title, description, content, featured_image, start_date, end_date, start_time, end_time, location, region_id, is_featured, views, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(&slug)
        .bind(title)
        .bind(description)
        .bind(content)
        .bind(featured_image)
        .bind(start_date)
        .bind(end_date)
        .bind(start_time)
        .bind(end_time)
        .bind(location)
        .bind(region_id)
        .bind(is_featured)
        .bind(created_by)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("events:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateEventInput) -> Result<Event, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Event not found".to_string()))?;

        let new_slug = input.title.as_ref().map(|t| generate_slug(t));

        sqlx::query(
            r#"
            UPDATE events SET
                slug = COALESCE(?, slug),
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                content = COALESCE(?, content),
                featured_image = COALESCE(?, featured_image),
                start_date = COALESCE(?, start_date),
                end_date = COALESCE(?, end_date),
                start_time = COALESCE(?, start_time),
                end_time = COALESCE(?, end_time),
                location = COALESCE(?, location),
                region_id = COALESCE(?, region_id),
                is_featured = COALESCE(?, is_featured),
                updated_at = NOW()
            WHERE id = ?
            "#,
        )
        .bind(new_slug)
        .bind(input.title)
        .bind(input.description)
        .bind(input.content)
        .bind(input.featured_image)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.start_time)
        .bind(input.end_time)
        .bind(input.location)
        .bind(input.region_id)
        .bind(input.is_featured)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("events:*").await;
        let _ = self
            .cache
            .delete(&format!("event:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("DELETE FROM events WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("events:*").await;
        if let Some(event) = existing {
            let _ = self
                .cache
                .delete(&format!("event:slug:{}", event.slug))
                .await;
        }

        Ok(())
    }
}
