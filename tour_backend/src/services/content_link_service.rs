use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::content_link::{ContentLink, ContentLinkSource, ContentLinkTarget, SetContentLinkItem},
    services::CacheService,
};

pub struct ContentLinkService {
    db: PgPool,
    #[allow(dead_code)]
    cache: CacheService,
}

impl ContentLinkService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// List all content links for a given source item, ordered by `display_order`.
    pub async fn list_for_source(
        &self,
        source_type: &str,
        source_id: &str,
    ) -> Result<Vec<ContentLink>, ApiError> {
        Self::validate_source_type(source_type)?;

        let links = sqlx::query_as::<_, ContentLink>(
            r#"
            SELECT id, source_type::text, source_id, target_type::text, target_id, display_order, created_at
            FROM content_links
            WHERE source_type = $1::content_link_source
              AND source_id = $2
            ORDER BY display_order ASC, created_at ASC
            "#,
        )
        .bind(source_type)
        .bind(source_id)
        .fetch_all(&self.db)
        .await?;

        Ok(links)
    }

    /// List all content links that point to a given target item.
    pub async fn list_for_target(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<Vec<ContentLink>, ApiError> {
        Self::validate_target_type(target_type)?;

        let links = sqlx::query_as::<_, ContentLink>(
            r#"
            SELECT id, source_type::text, source_id, target_type::text, target_id, display_order, created_at
            FROM content_links
            WHERE target_type = $1::content_link_target
              AND target_id = $2
            ORDER BY display_order ASC, created_at ASC
            "#,
        )
        .bind(target_type)
        .bind(target_id)
        .fetch_all(&self.db)
        .await?;

        Ok(links)
    }

    /// Get a single content link by ID.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<ContentLink>, ApiError> {
        let link = sqlx::query_as::<_, ContentLink>(
            r#"
            SELECT id, source_type::text, source_id, target_type::text, target_id, display_order, created_at
            FROM content_links
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(link)
    }

    /// Create a single content link.
    pub async fn create(
        &self,
        source_type: &str,
        source_id: &str,
        target_type: &str,
        target_id: &str,
        display_order: Option<i32>,
    ) -> Result<ContentLink, ApiError> {
        Self::validate_source_type(source_type)?;
        Self::validate_target_type(target_type)?;
        Self::validate_no_self_link(source_type, source_id, target_type, target_id)?;

        let id = Uuid::new_v4().to_string();
        let order = display_order.unwrap_or(0);

        let link = sqlx::query_as::<_, ContentLink>(
            r#"
            INSERT INTO content_links (id, source_type, source_id, target_type, target_id, display_order)
            VALUES ($1, $2::content_link_source, $3, $4::content_link_target, $5, $6)
            RETURNING id, source_type::text, source_id, target_type::text, target_id, display_order, created_at
            "#,
        )
        .bind(&id)
        .bind(source_type)
        .bind(source_id)
        .bind(target_type)
        .bind(target_id)
        .bind(order)
        .fetch_one(&self.db)
        .await?;

        Ok(link)
    }

    /// Update the display order of a content link.
    pub async fn update_order(
        &self,
        id: &str,
        display_order: i32,
    ) -> Result<ContentLink, ApiError> {
        let link = sqlx::query_as::<_, ContentLink>(
            r#"
            UPDATE content_links
            SET display_order = $2
            WHERE id = $1
            RETURNING id, source_type::text, source_id, target_type::text, target_id, display_order, created_at
            "#,
        )
        .bind(id)
        .bind(display_order)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Content link '{}' not found", id)))?;

        Ok(link)
    }

    /// Delete a single content link by ID.
    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM content_links WHERE id = $1")
            .bind(id)
            .execute(&self.db)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound(format!(
                "Content link '{}' not found",
                id
            )));
        }

        Ok(())
    }

    /// Replace all content links for a given source item with the provided list.
    ///
    /// This is a transactional "set" operation:
    /// 1. Delete all existing links for `(source_type, source_id)`.
    /// 2. Insert the new links in order.
    ///
    /// If the input list is empty, all existing links are removed (unlinking).
    pub async fn set_links(
        &self,
        source_type: &str,
        source_id: &str,
        links: &[SetContentLinkItem],
    ) -> Result<Vec<ContentLink>, ApiError> {
        Self::validate_source_type(source_type)?;

        // Validate all target types up front before starting the transaction
        for (i, item) in links.iter().enumerate() {
            Self::validate_target_type(&item.target_type).map_err(|_| {
                ApiError::ValidationError(format!(
                    "Invalid target_type '{}' at index {}. Must be one of: {}",
                    item.target_type,
                    i,
                    ContentLinkTarget::VALID.join(", ")
                ))
            })?;
            Self::validate_no_self_link(
                source_type,
                source_id,
                &item.target_type,
                &item.target_id,
            )?;
        }

        let mut tx = self.db.begin().await?;

        // 1. Remove existing links for this source
        sqlx::query(
            r#"
            DELETE FROM content_links
            WHERE source_type = $1::content_link_source
              AND source_id = $2
            "#,
        )
        .bind(source_type)
        .bind(source_id)
        .execute(&mut *tx)
        .await?;

        // 2. Insert new links
        let mut result = Vec::with_capacity(links.len());
        for (i, item) in links.iter().enumerate() {
            let id = Uuid::new_v4().to_string();
            let order = item.display_order.unwrap_or(i as i32);

            let link = sqlx::query_as::<_, ContentLink>(
                r#"
                INSERT INTO content_links (id, source_type, source_id, target_type, target_id, display_order)
                VALUES ($1, $2::content_link_source, $3, $4::content_link_target, $5, $6)
                RETURNING id, source_type::text, source_id, target_type::text, target_id, display_order, created_at
                "#,
            )
            .bind(&id)
            .bind(source_type)
            .bind(source_id)
            .bind(&item.target_type)
            .bind(&item.target_id)
            .bind(order)
            .fetch_one(&mut *tx)
            .await?;

            result.push(link);
        }

        tx.commit().await?;

        Ok(result)
    }

    /// Delete all content links for a given source item.
    pub async fn delete_all_for_source(
        &self,
        source_type: &str,
        source_id: &str,
    ) -> Result<u64, ApiError> {
        Self::validate_source_type(source_type)?;

        let result = sqlx::query(
            r#"
            DELETE FROM content_links
            WHERE source_type = $1::content_link_source
              AND source_id = $2
            "#,
        )
        .bind(source_type)
        .bind(source_id)
        .execute(&self.db)
        .await?;

        Ok(result.rows_affected())
    }

    /// Count links for a given source item.
    pub async fn count_for_source(
        &self,
        source_type: &str,
        source_id: &str,
    ) -> Result<i64, ApiError> {
        Self::validate_source_type(source_type)?;

        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM content_links
            WHERE source_type = $1::content_link_source
              AND source_id = $2
            "#,
        )
        .bind(source_type)
        .bind(source_id)
        .fetch_one(&self.db)
        .await?;

        Ok(row.0)
    }

    // ── Validation helpers ───────────────────────────────────────────────

    fn validate_source_type(source_type: &str) -> Result<(), ApiError> {
        ContentLinkSource::from_str(source_type).ok_or_else(|| {
            ApiError::ValidationError(format!(
                "Invalid source_type '{}'. Must be one of: {}",
                source_type,
                ContentLinkSource::VALID.join(", ")
            ))
        })?;
        Ok(())
    }

    fn validate_target_type(target_type: &str) -> Result<(), ApiError> {
        ContentLinkTarget::from_str(target_type).ok_or_else(|| {
            ApiError::ValidationError(format!(
                "Invalid target_type '{}'. Must be one of: {}",
                target_type,
                ContentLinkTarget::VALID.join(", ")
            ))
        })?;
        Ok(())
    }

    /// Prevent linking an item to itself (same type + same ID).
    fn validate_no_self_link(
        source_type: &str,
        source_id: &str,
        target_type: &str,
        target_id: &str,
    ) -> Result<(), ApiError> {
        // A "post" source linking to a "post" target with the same ID is a self-link.
        // (cross-type links like region→post are always fine, even if IDs happen to match.)
        if source_type == target_type && source_id == target_id {
            return Err(ApiError::ValidationError(
                "Cannot link a content item to itself".to_string(),
            ));
        }
        Ok(())
    }
}
