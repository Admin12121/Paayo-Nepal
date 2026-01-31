use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{
    error::ApiError, handlers::activities::UpdateActivityInput, models::activity::Activity,
    services::CacheService, utils::slug::generate_slug,
};

pub struct ActivityService {
    db: MySqlPool,
    cache: CacheService,
}

impl ActivityService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        is_active: Option<bool>,
    ) -> Result<(Vec<Activity>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let activities: Vec<Activity> = if let Some(active) = is_active {
            sqlx::query_as(
                "SELECT * FROM activities WHERE is_active = ? ORDER BY display_order ASC, name ASC LIMIT ? OFFSET ?"
            )
            .bind(active)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                "SELECT * FROM activities ORDER BY display_order ASC, name ASC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?
        };

        let total: (i64,) = if let Some(active) = is_active {
            sqlx::query_as("SELECT COUNT(*) FROM activities WHERE is_active = ?")
                .bind(active)
                .fetch_one(&self.db)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM activities")
                .fetch_one(&self.db)
                .await?
        };

        Ok((activities, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Activity>, ApiError> {
        let activity = sqlx::query_as::<_, Activity>("SELECT * FROM activities WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.db)
            .await?;

        Ok(activity)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Activity>, ApiError> {
        let activity = sqlx::query_as::<_, Activity>("SELECT * FROM activities WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(activity)
    }

    pub async fn create(
        &self,
        name: &str,
        description: Option<&str>,
        content: Option<&str>,
        featured_image: Option<&str>,
        hero_image: Option<&str>,
        icon: Option<&str>,
        display_order: Option<i32>,
        is_active: bool,
        created_by: &str,
    ) -> Result<Activity, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(name);

        sqlx::query(
            r#"
            INSERT INTO activities (id, slug, name, description, content, featured_image, hero_image, icon, display_order, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(&slug)
        .bind(name)
        .bind(description)
        .bind(content)
        .bind(featured_image)
        .bind(hero_image)
        .bind(icon)
        .bind(display_order.unwrap_or(0))
        .bind(is_active)
        .bind(created_by)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("activities:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn update(&self, id: &str, input: UpdateActivityInput) -> Result<Activity, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Activity not found".to_string()))?;

        let new_slug = input.name.as_ref().map(|n| generate_slug(n));

        sqlx::query(
            r#"
            UPDATE activities SET
                slug = COALESCE(?, slug),
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                content = COALESCE(?, content),
                featured_image = COALESCE(?, featured_image),
                hero_image = COALESCE(?, hero_image),
                icon = COALESCE(?, icon),
                display_order = COALESCE(?, display_order),
                is_active = COALESCE(?, is_active),
                updated_at = NOW()
            WHERE id = ?
            "#,
        )
        .bind(new_slug)
        .bind(input.name)
        .bind(input.description)
        .bind(input.content)
        .bind(input.featured_image)
        .bind(input.hero_image)
        .bind(input.icon)
        .bind(input.display_order)
        .bind(input.is_active)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("activities:*").await;
        let _ = self
            .cache
            .delete(&format!("activity:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("DELETE FROM activities WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("activities:*").await;
        if let Some(activity) = existing {
            let _ = self
                .cache
                .delete(&format!("activity:slug:{}", activity.slug))
                .await;
        }

        Ok(())
    }
}
