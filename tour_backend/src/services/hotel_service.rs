use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::hotel::{Hotel, HotelBranch, HotelWithBranches},
    services::CacheService,
    utils::slug::generate_slug,
};

/// Maximum slug generation attempts before returning a conflict error.
const MAX_SLUG_RETRIES: usize = 5;

pub struct HotelService {
    db: PgPool,
    cache: CacheService,
}

impl HotelService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List hotels with optional filters. Always excludes soft-deleted hotels.
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        status: Option<&str>,
        region_id: Option<&str>,
        price_range: Option<&str>,
        is_featured: Option<bool>,
        sort_by: Option<&str>,
    ) -> Result<(Vec<Hotel>, i64), ApiError> {
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

        if let Some(p) = price_range {
            param_idx += 1;
            where_clauses.push(format!("price_range = ${}::hotel_price_range", param_idx));
            bind_values.push(p.to_string());
        }

        if let Some(f) = is_featured {
            param_idx += 1;
            where_clauses.push(format!("is_featured = ${}", param_idx));
            bind_values.push(f.to_string());
        }

        let where_sql = where_clauses.join(" AND ");

        let order_clause = match sort_by {
            Some("latest") => "created_at DESC",
            Some("name") => "name ASC",
            Some("most_viewed") => "view_count DESC, created_at DESC",
            Some("star_rating") => "star_rating DESC NULLS LAST, name ASC",
            // Default: featured-first ordering per PROJECT.md
            // Featured hotels (with display_order) come first sorted by display_order,
            // then non-featured hotels sorted by publish date.
            _ => "is_featured DESC, CASE WHEN display_order IS NOT NULL THEN 0 ELSE 1 END, display_order ASC, published_at DESC NULLS LAST, created_at DESC",
        };

        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;
        let data_sql = format!(
            "SELECT * FROM hotels WHERE {} ORDER BY {} LIMIT ${} OFFSET ${}",
            where_sql, order_clause, limit_idx, offset_idx
        );
        let count_sql = format!("SELECT COUNT(*) FROM hotels WHERE {}", where_sql);

        let mut data_q = sqlx::query_as::<_, Hotel>(&data_sql);
        for b in &bind_values {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit as i64).bind(offset as i64);
        let hotels: Vec<Hotel> = data_q.fetch_all(&self.db).await?;

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &bind_values {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((hotels, total.0))
    }

    /// Get a hotel by slug. Excludes soft-deleted hotels.
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Hotel>, ApiError> {
        let hotel = sqlx::query_as::<_, Hotel>(
            "SELECT * FROM hotels WHERE slug = $1 AND deleted_at IS NULL",
        )
        .bind(slug)
        .fetch_optional(&self.db)
        .await?;

        Ok(hotel)
    }

    /// Get a hotel by ID. Excludes soft-deleted hotels.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<Hotel>, ApiError> {
        let hotel =
            sqlx::query_as::<_, Hotel>("SELECT * FROM hotels WHERE id = $1 AND deleted_at IS NULL")
                .bind(id)
                .fetch_optional(&self.db)
                .await?;

        Ok(hotel)
    }

    /// Get a hotel by ID including soft-deleted (for admin restore).
    pub async fn get_by_id_including_deleted(&self, id: &str) -> Result<Option<Hotel>, ApiError> {
        let hotel = sqlx::query_as::<_, Hotel>("SELECT * FROM hotels WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(hotel)
    }

    /// Get hotel with all its branches.
    pub async fn get_with_branches(&self, id: &str) -> Result<Option<HotelWithBranches>, ApiError> {
        let hotel = match self.get_by_id(id).await? {
            Some(h) => h,
            None => return Ok(None),
        };

        let branches = self.list_branches(id).await?;

        Ok(Some(HotelWithBranches::from_hotel_and_branches(
            hotel, branches,
        )))
    }

    /// Get hotel with branches by slug.
    pub async fn get_with_branches_by_slug(
        &self,
        slug: &str,
    ) -> Result<Option<HotelWithBranches>, ApiError> {
        let hotel = match self.get_by_slug(slug).await? {
            Some(h) => h,
            None => return Ok(None),
        };

        let branches = self.list_branches(&hotel.id).await?;

        Ok(Some(HotelWithBranches::from_hotel_and_branches(
            hotel, branches,
        )))
    }

    /// Create a new hotel.
    pub async fn create(
        &self,
        author_id: &str,
        name: &str,
        description: Option<&str>,
        email: Option<&str>,
        phone: Option<&str>,
        website: Option<&str>,
        star_rating: Option<i16>,
        price_range: Option<&str>,
        amenities: Option<&serde_json::Value>,
        cover_image: Option<&str>,
        gallery: Option<&serde_json::Value>,
        region_id: Option<&str>,
        is_featured: bool,
    ) -> Result<Hotel, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(name);

        sqlx::query(
            r#"
            INSERT INTO hotels (
                id, author_id, name, slug, description,
                email, phone, website, star_rating, price_range,
                amenities, cover_image, gallery, region_id, is_featured,
                status, view_count, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10::hotel_price_range,
                $11, $12, $13, $14, $15,
                'draft', 0, NOW(), NOW()
            )
            "#,
        )
        .bind(&id)
        .bind(author_id)
        .bind(name)
        .bind(&slug)
        .bind(description)
        .bind(email)
        .bind(phone)
        .bind(website)
        .bind(star_rating)
        .bind(price_range)
        .bind(amenities)
        .bind(cover_image)
        .bind(gallery)
        .bind(region_id)
        .bind(is_featured)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("hotels:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update an existing hotel. Only updates provided (non-None) fields.
    pub async fn update(
        &self,
        id: &str,
        name: Option<&str>,
        description: Option<&str>,
        email: Option<&str>,
        phone: Option<&str>,
        website: Option<&str>,
        star_rating: Option<i16>,
        price_range: Option<&str>,
        amenities: Option<&serde_json::Value>,
        cover_image: Option<&str>,
        gallery: Option<&serde_json::Value>,
        region_id: Option<&str>,
        is_featured: Option<bool>,
        status: Option<&str>,
    ) -> Result<Hotel, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

        // Generate a unique slug when name changes, with collision retry loop.
        let new_slug = if let Some(n) = name {
            let mut slug_candidate = generate_slug(n);
            let mut found_unique = false;

            for attempt in 0..MAX_SLUG_RETRIES {
                let conflict = sqlx::query_as::<_, (i64,)>(
                    "SELECT COUNT(*) FROM hotels WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
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
                    "Slug collision on hotel update attempt {} for name '{}', slug '{}'. Retrying...",
                    attempt + 1,
                    n,
                    slug_candidate,
                );
                slug_candidate = generate_slug(n);
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
            UPDATE hotels SET
                slug = COALESCE($1, slug),
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                website = COALESCE($6, website),
                star_rating = COALESCE($7, star_rating),
                price_range = COALESCE($8::hotel_price_range, price_range),
                amenities = COALESCE($9, amenities),
                cover_image = COALESCE($10, cover_image),
                gallery = COALESCE($11, gallery),
                region_id = CASE
                    WHEN $12 IS NULL THEN region_id
                    WHEN $12 = '' THEN NULL
                    ELSE $12
                END,
                is_featured = COALESCE($13, is_featured),
                status = COALESCE($14::content_status, status)
            WHERE id = $15 AND deleted_at IS NULL
            "#,
        )
        .bind(new_slug.as_deref())
        .bind(name)
        .bind(description)
        .bind(email)
        .bind(phone)
        .bind(website)
        .bind(star_rating)
        .bind(price_range)
        .bind(amenities)
        .bind(cover_image)
        .bind(gallery)
        .bind(region_id)
        .bind(is_featured)
        .bind(status)
        .bind(id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("hotels:*").await;
        let _ = self
            .cache
            .delete(&format!("hotel:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or(ApiError::InternalServerError)
    }

    /// Update hotel status (draft/published). Sets published_at on first publish.
    pub async fn update_status(&self, id: &str, status: &str) -> Result<Hotel, ApiError> {
        let published_at = if status == "published" {
            Some(chrono::Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE hotels SET
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

        let _ = self.cache.invalidate("hotels:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))
    }

    /// Soft delete a hotel.
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("UPDATE hotels SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("hotels:*").await;
        if let Some(hotel) = existing {
            let _ = self
                .cache
                .delete(&format!("hotel:slug:{}", hotel.slug))
                .await;
        }

        Ok(())
    }

    /// Restore a soft-deleted hotel.
    pub async fn restore(&self, id: &str) -> Result<Hotel, ApiError> {
        sqlx::query("UPDATE hotels SET deleted_at = NULL WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("hotels:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))
    }

    /// Hard delete a hotel permanently (admin only, for trash cleanup).
    pub async fn hard_delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id_including_deleted(id).await?;

        sqlx::query("DELETE FROM hotels WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("hotels:*").await;
        if let Some(hotel) = existing {
            let _ = self
                .cache
                .delete(&format!("hotel:slug:{}", hotel.slug))
                .await;
        }

        Ok(())
    }

    /// Update display order for a hotel (admin).
    pub async fn update_display_order(
        &self,
        id: &str,
        display_order: Option<i32>,
    ) -> Result<Hotel, ApiError> {
        sqlx::query("UPDATE hotels SET display_order = $1 WHERE id = $2 AND deleted_at IS NULL")
            .bind(display_order)
            .bind(id)
            .execute(&self.db)
            .await?;

        let _ = self.cache.invalidate("hotels:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))
    }

    /// List soft-deleted hotels (for admin trash view).
    pub async fn list_deleted(&self, page: i32, limit: i32) -> Result<(Vec<Hotel>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let hotels: Vec<Hotel> = sqlx::query_as(
            r#"
            SELECT * FROM hotels
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
            sqlx::query_as("SELECT COUNT(*) FROM hotels WHERE deleted_at IS NOT NULL")
                .fetch_one(&self.db)
                .await?;

        Ok((hotels, total.0))
    }

    // =========================================================================
    // BRANCH MANAGEMENT
    // =========================================================================

    /// List all branches for a hotel.
    pub async fn list_branches(&self, hotel_id: &str) -> Result<Vec<HotelBranch>, ApiError> {
        let branches: Vec<HotelBranch> = sqlx::query_as(
            r#"
            SELECT * FROM hotel_branches
            WHERE hotel_id = $1
            ORDER BY is_main DESC, name ASC
            "#,
        )
        .bind(hotel_id)
        .fetch_all(&self.db)
        .await?;

        Ok(branches)
    }

    /// Get a single branch by ID.
    pub async fn get_branch_by_id(&self, branch_id: &str) -> Result<Option<HotelBranch>, ApiError> {
        let branch = sqlx::query_as::<_, HotelBranch>("SELECT * FROM hotel_branches WHERE id = $1")
            .bind(branch_id)
            .fetch_optional(&self.db)
            .await?;

        Ok(branch)
    }

    /// Add a branch to a hotel.
    pub async fn add_branch(
        &self,
        hotel_id: &str,
        name: &str,
        address: Option<&str>,
        phone: Option<&str>,
        email: Option<&str>,
        coordinates: Option<&serde_json::Value>,
        is_main: bool,
    ) -> Result<HotelBranch, ApiError> {
        // Verify hotel exists
        self.get_by_id(hotel_id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Hotel not found".to_string()))?;

        let id = Uuid::new_v4().to_string();

        // If this branch is marked as main, unset any existing main branch
        if is_main {
            sqlx::query("UPDATE hotel_branches SET is_main = false WHERE hotel_id = $1")
                .bind(hotel_id)
                .execute(&self.db)
                .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO hotel_branches (
                id, hotel_id, name, address, phone, email,
                coordinates, is_main, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            "#,
        )
        .bind(&id)
        .bind(hotel_id)
        .bind(name)
        .bind(address)
        .bind(phone)
        .bind(email)
        .bind(coordinates)
        .bind(is_main)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("hotels:*").await;

        let branch = sqlx::query_as::<_, HotelBranch>("SELECT * FROM hotel_branches WHERE id = $1")
            .bind(&id)
            .fetch_one(&self.db)
            .await?;

        Ok(branch)
    }

    /// Update a branch.
    pub async fn update_branch(
        &self,
        branch_id: &str,
        name: Option<&str>,
        address: Option<&str>,
        phone: Option<&str>,
        email: Option<&str>,
        coordinates: Option<&serde_json::Value>,
        is_main: Option<bool>,
    ) -> Result<HotelBranch, ApiError> {
        // If setting as main, unset any existing main branch for this hotel
        if is_main == Some(true) {
            let branch =
                sqlx::query_as::<_, HotelBranch>("SELECT * FROM hotel_branches WHERE id = $1")
                    .bind(branch_id)
                    .fetch_optional(&self.db)
                    .await?
                    .ok_or_else(|| ApiError::NotFound("Branch not found".to_string()))?;

            sqlx::query("UPDATE hotel_branches SET is_main = false WHERE hotel_id = $1")
                .bind(&branch.hotel_id)
                .execute(&self.db)
                .await?;
        }

        sqlx::query(
            r#"
            UPDATE hotel_branches SET
                name = COALESCE($1, name),
                address = COALESCE($2, address),
                phone = COALESCE($3, phone),
                email = COALESCE($4, email),
                coordinates = COALESCE($5, coordinates),
                is_main = COALESCE($6, is_main)
            WHERE id = $7
            "#,
        )
        .bind(name)
        .bind(address)
        .bind(phone)
        .bind(email)
        .bind(coordinates)
        .bind(is_main)
        .bind(branch_id)
        .execute(&self.db)
        .await?;

        let _ = self.cache.invalidate("hotels:*").await;

        let branch = sqlx::query_as::<_, HotelBranch>("SELECT * FROM hotel_branches WHERE id = $1")
            .bind(branch_id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("Branch not found".to_string()))?;

        Ok(branch)
    }

    /// Remove a branch.
    pub async fn remove_branch(&self, branch_id: &str) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM hotel_branches WHERE id = $1")
            .bind(branch_id)
            .execute(&self.db)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound("Branch not found".to_string()));
        }

        let _ = self.cache.invalidate("hotels:*").await;

        Ok(())
    }

    /// Count branches for a hotel.
    pub async fn count_branches(&self, hotel_id: &str) -> Result<i64, ApiError> {
        let (count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM hotel_branches WHERE hotel_id = $1")
                .bind(hotel_id)
                .fetch_one(&self.db)
                .await?;
        Ok(count)
    }

    /// Increment view count (called from view_service).
    pub async fn increment_view_count(&self, id: &str) -> Result<(), ApiError> {
        sqlx::query("UPDATE hotels SET view_count = view_count + 1 WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(())
    }
}
