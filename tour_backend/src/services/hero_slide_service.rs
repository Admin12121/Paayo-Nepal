use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::hero_slide::{HeroContentType, HeroSlide, HeroSlideResolved},
    services::CacheService,
};

pub struct HeroSlideService {
    db: PgPool,
    cache: CacheService,
}

impl HeroSlideService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List all hero slides ordered by sort_order.
    /// If `active_only` is true, only returns active slides within their scheduled window.
    pub async fn list(&self, active_only: bool) -> Result<Vec<HeroSlide>, ApiError> {
        let slides: Vec<HeroSlide> = if active_only {
            sqlx::query_as(
                r#"
                SELECT * FROM hero_slides
                WHERE is_active = true
                  AND (starts_at IS NULL OR starts_at <= NOW())
                  AND (ends_at IS NULL OR ends_at >= NOW())
                ORDER BY sort_order ASC
                "#,
            )
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT * FROM hero_slides
                ORDER BY sort_order ASC, created_at DESC
                "#,
            )
            .fetch_all(&self.db)
            .await?
        };

        Ok(slides)
    }

    /// Get a hero slide by ID.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<HeroSlide>, ApiError> {
        let slide = sqlx::query_as::<_, HeroSlide>("SELECT * FROM hero_slides WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(slide)
    }

    /// Get all active hero slides resolved with their linked content data.
    /// For 'custom' slides, uses the custom_* fields directly.
    /// For content-linked slides (post/video/photo), fetches the linked content's title, description, image, and URL.
    pub async fn list_resolved(&self) -> Result<Vec<HeroSlideResolved>, ApiError> {
        let slides = self.list(true).await?;
        let mut resolved = Vec::with_capacity(slides.len());

        for slide in &slides {
            let r = self.resolve_slide(slide).await?;
            resolved.push(r);
        }

        Ok(resolved)
    }

    /// Resolve a single slide: fetch linked content data if it's not a custom slide.
    async fn resolve_slide(&self, slide: &HeroSlide) -> Result<HeroSlideResolved, ApiError> {
        if slide.content_type == HeroContentType::Custom || slide.content_id.is_none() {
            return Ok(HeroSlideResolved::from_custom(slide));
        }

        let content_id = slide.content_id.as_deref().unwrap();

        match slide.content_type {
            HeroContentType::Post => {
                let row: Option<(String, Option<String>, Option<String>, String, String)> = sqlx::query_as(
                    r#"
                        SELECT title, short_description, cover_image, slug, type::text
                        FROM posts
                        WHERE id = $1 AND deleted_at IS NULL AND status = 'published'
                        "#,
                )
                .bind(content_id)
                .fetch_optional(&self.db)
                .await?;

                match row {
                    Some((title, desc, image, slug, post_type)) => {
                        let link = Self::public_post_path(&post_type, &slug);
                        Ok(HeroSlideResolved::from_content(
                            slide,
                            Some(title),
                            desc,
                            image,
                            Some(link),
                        ))
                    }
                    None => Ok(HeroSlideResolved::from_custom(slide)),
                }
            }
            HeroContentType::Video => {
                let row: Option<(String, Option<String>, Option<String>, String)> = sqlx::query_as(
                    r#"
                        SELECT title, description, thumbnail_url, slug
                        FROM videos
                        WHERE id = $1 AND deleted_at IS NULL AND status = 'published'
                        "#,
                )
                .bind(content_id)
                .fetch_optional(&self.db)
                .await?;

                match row {
                    Some((title, desc, image, slug)) => Ok(HeroSlideResolved::from_content(
                        slide,
                        Some(title),
                        desc,
                        image,
                        Some(format!("/videos/{}", slug)),
                    )),
                    None => Ok(HeroSlideResolved::from_custom(slide)),
                }
            }
            HeroContentType::Photo => {
                let row: Option<(String, Option<String>, String)> = sqlx::query_as(
                    r#"
                    SELECT pf.title, pf.description, pf.slug
                    FROM photo_features pf
                    WHERE pf.id = $1 AND pf.deleted_at IS NULL AND pf.status = 'published'
                    "#,
                )
                .bind(content_id)
                .fetch_optional(&self.db)
                .await?;

                match row {
                    Some((title, desc, slug)) => {
                        // Try to get the first image from photo_images for the cover
                        let first_image: Option<(String,)> = sqlx::query_as(
                            r#"
                            SELECT image_url FROM photo_images
                            WHERE photo_feature_id = $1
                            ORDER BY display_order ASC NULLS LAST
                            LIMIT 1
                            "#,
                        )
                        .bind(content_id)
                        .fetch_optional(&self.db)
                        .await?;

                        Ok(HeroSlideResolved::from_content(
                            slide,
                            Some(title),
                            desc,
                            first_image.map(|(url,)| url),
                            Some(format!("/photos/{}", slug)),
                        ))
                    }
                    None => Ok(HeroSlideResolved::from_custom(slide)),
                }
            }
            HeroContentType::Custom => Ok(HeroSlideResolved::from_custom(slide)),
        }
    }

    fn public_post_path(post_type: &str, slug: &str) -> String {
        match post_type {
            "event" => format!("/events/{}", slug),
            "activity" => format!("/activities/{}", slug),
            "explore" | "attraction" => format!("/attractions/{}", slug),
            _ => format!("/blogs/{}", slug),
        }
    }

    /// Create a new hero slide.
    pub async fn create(
        &self,
        content_type: &str,
        content_id: Option<&str>,
        custom_title: Option<&str>,
        custom_description: Option<&str>,
        custom_image: Option<&str>,
        custom_link: Option<&str>,
        sort_order: Option<i32>,
        is_active: bool,
        starts_at: Option<&str>,
        ends_at: Option<&str>,
    ) -> Result<HeroSlide, ApiError> {
        let id = Uuid::new_v4().to_string();

        // Default sort_order: max + 1
        let order = if let Some(o) = sort_order {
            o
        } else {
            let max: (Option<i32>,) = sqlx::query_as("SELECT MAX(sort_order) FROM hero_slides")
                .fetch_one(&self.db)
                .await?;
            max.0.unwrap_or(0) + 1
        };

        sqlx::query(
            r#"
            INSERT INTO hero_slides (
                id, content_type, content_id,
                custom_title, custom_description, custom_image, custom_link,
                sort_order, is_active, starts_at, ends_at,
                created_at, updated_at
            )
            VALUES (
                $1, $2::hero_content_type, $3,
                $4, $5, $6, $7,
                $8, $9, $10::timestamptz, $11::timestamptz,
                NOW(), NOW()
            )
            "#,
        )
        .bind(&id)
        .bind(content_type)
        .bind(content_id)
        .bind(custom_title)
        .bind(custom_description)
        .bind(custom_image)
        .bind(custom_link)
        .bind(order)
        .bind(is_active)
        .bind(starts_at)
        .bind(ends_at)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("hero_slides:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update an existing hero slide. Only updates provided (non-None) fields.
    pub async fn update(
        &self,
        id: &str,
        content_type: Option<&str>,
        content_id: Option<&str>,
        custom_title: Option<&str>,
        custom_description: Option<&str>,
        custom_image: Option<&str>,
        custom_link: Option<&str>,
        sort_order: Option<i32>,
        is_active: Option<bool>,
        starts_at: Option<&str>,
        ends_at: Option<&str>,
    ) -> Result<HeroSlide, ApiError> {
        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hero slide not found".to_string()))?;

        sqlx::query(
            r#"
            UPDATE hero_slides SET
                content_type = COALESCE($1::hero_content_type, content_type),
                content_id = COALESCE($2, content_id),
                custom_title = COALESCE($3, custom_title),
                custom_description = COALESCE($4, custom_description),
                custom_image = COALESCE($5, custom_image),
                custom_link = COALESCE($6, custom_link),
                sort_order = COALESCE($7, sort_order),
                is_active = COALESCE($8, is_active),
                starts_at = COALESCE($9::timestamptz, starts_at),
                ends_at = COALESCE($10::timestamptz, ends_at)
            WHERE id = $11
            "#,
        )
        .bind(content_type)
        .bind(content_id)
        .bind(custom_title)
        .bind(custom_description)
        .bind(custom_image)
        .bind(custom_link)
        .bind(sort_order)
        .bind(is_active)
        .bind(starts_at)
        .bind(ends_at)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("hero_slides:*").await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Toggle active status for a hero slide.
    pub async fn toggle_active(&self, id: &str) -> Result<HeroSlide, ApiError> {
        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hero slide not found".to_string()))?;

        sqlx::query("UPDATE hero_slides SET is_active = NOT is_active WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("hero_slides:*").await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Delete a hero slide.
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("DELETE FROM hero_slides WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("hero_slides:*").await;

        Ok(())
    }

    /// Reorder hero slides. Accepts a list of (slide_id, new_sort_order) pairs.
    pub async fn reorder(&self, orders: &[(String, i32)]) -> Result<(), ApiError> {
        for (slide_id, new_order) in orders {
            sqlx::query("UPDATE hero_slides SET sort_order = $1 WHERE id = $2")
                .bind(new_order)
                .bind(slide_id)
                .execute(&self.db)
                .await?;
        }

        let _ = self.cache.invalidate("hero_slides:*").await;

        Ok(())
    }

    /// Count total hero slides.
    pub async fn count(&self) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM hero_slides")
            .fetch_one(&self.db)
            .await?;
        Ok(count)
    }

    /// Count active hero slides (currently visible).
    pub async fn count_active(&self) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM hero_slides
            WHERE is_active = true
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            "#,
        )
        .fetch_one(&self.db)
        .await?;
        Ok(count)
    }
}
