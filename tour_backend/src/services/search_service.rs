use sqlx::PgPool;

use crate::{error::ApiError, services::CacheService};

/// A single search result returned to the client.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub cover_image: Option<String>,
    pub result_type: String,
    pub url: String,
    pub rank: f32,
}

pub struct SearchService {
    db: PgPool,
    #[allow(dead_code)]
    cache: CacheService,
}

impl SearchService {
    pub fn new(db: PgPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    /// Full-text search across all content types using PostgreSQL tsvector/tsquery.
    /// Falls back to ILIKE for very short queries (< 3 chars) where FTS is less useful.
    pub async fn search(
        &self,
        query: &str,
        search_type: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Err(ApiError::BadRequest(
                "Search query cannot be empty".to_string(),
            ));
        }

        let mut results = Vec::new();
        let mut total: i64 = 0;

        // Build a tsquery from the user input.
        // Split words and join with & (AND) for multi-word queries.
        let ts_query = build_tsquery(trimmed);
        let ilike_pattern = format!("%{}%", escape_like(trimmed));

        // --- Posts (articles) ---
        if search_type == "all" || search_type == "posts" || search_type == "article" {
            let (mut r, c) = self
                .search_posts(
                    &ts_query,
                    &ilike_pattern,
                    "article",
                    "post",
                    "/articles/",
                    limit,
                )
                .await?;
            total += c;
            results.append(&mut r);
        }

        // --- Events ---
        if search_type == "all" || search_type == "events" {
            let (mut r, c) = self
                .search_posts(
                    &ts_query,
                    &ilike_pattern,
                    "event",
                    "event",
                    "/events/",
                    limit,
                )
                .await?;
            total += c;
            results.append(&mut r);
        }

        // --- Attractions (explore) ---
        if search_type == "all" || search_type == "attractions" {
            let (mut r, c) = self
                .search_posts(
                    &ts_query,
                    &ilike_pattern,
                    "explore",
                    "attraction",
                    "/attractions/",
                    limit,
                )
                .await?;
            total += c;
            results.append(&mut r);
        }

        // --- Activities ---
        if search_type == "all" || search_type == "activities" {
            let (mut r, c) = self
                .search_posts(
                    &ts_query,
                    &ilike_pattern,
                    "activity",
                    "activity",
                    "/activities/",
                    limit,
                )
                .await?;
            total += c;
            results.append(&mut r);
        }

        // --- Regions ---
        if search_type == "all" || search_type == "regions" {
            let (mut r, c) = self
                .search_regions(&ts_query, &ilike_pattern, limit)
                .await?;
            total += c;
            results.append(&mut r);
        }

        // --- Videos ---
        if search_type == "all" || search_type == "videos" {
            let (mut r, c) = self.search_videos(&ts_query, &ilike_pattern, limit).await?;
            total += c;
            results.append(&mut r);
        }

        // --- Photo features ---
        if search_type == "all" || search_type == "photos" {
            let (mut r, c) = self.search_photos(&ts_query, &ilike_pattern, limit).await?;
            total += c;
            results.append(&mut r);
        }

        // --- Hotels ---
        if search_type == "all" || search_type == "hotels" {
            let (mut r, c) = self.search_hotels(&ts_query, &ilike_pattern, limit).await?;
            total += c;
            results.append(&mut r);
        }

        // Sort by rank descending and truncate
        results.sort_by(|a, b| {
            b.rank
                .partial_cmp(&a.rank)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(limit as usize);

        Ok((results, total))
    }

    /// Search within the posts table for a specific post type.
    async fn search_posts(
        &self,
        ts_query: &str,
        ilike_pattern: &str,
        post_type: &str,
        result_type: &str,
        url_prefix: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let rows: Vec<(String, String, String, Option<String>, Option<String>, f32)> =
            sqlx::query_as(
                r#"
                SELECT
                    id, title, slug, short_description, cover_image,
                    ts_rank(
                        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, '')),
                        to_tsquery('english', $1)
                    ) AS rank
                FROM posts
                WHERE type = $2::post_type
                  AND status = 'published'
                  AND deleted_at IS NULL
                  AND (
                      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, ''))
                      @@ to_tsquery('english', $1)
                      OR title ILIKE $3
                      OR short_description ILIKE $3
                  )
                ORDER BY rank DESC, created_at DESC
                LIMIT $4
                "#,
            )
            .bind(ts_query)
            .bind(post_type)
            .bind(ilike_pattern)
            .bind(limit as i64)
            .fetch_all(&self.db)
            .await?;

        let results: Vec<SearchResult> = rows
            .iter()
            .map(|(id, title, slug, desc, img, rank)| SearchResult {
                id: id.clone(),
                title: title.clone(),
                slug: slug.clone(),
                excerpt: desc.clone(),
                cover_image: img.clone(),
                result_type: result_type.to_string(),
                url: format!("{}{}", url_prefix, slug),
                rank: *rank,
            })
            .collect();

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM posts
            WHERE type = $1::post_type
              AND status = 'published'
              AND deleted_at IS NULL
              AND (
                  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, ''))
                  @@ to_tsquery('english', $2)
                  OR title ILIKE $3
                  OR short_description ILIKE $3
              )
            "#,
        )
        .bind(post_type)
        .bind(ts_query)
        .bind(ilike_pattern)
        .fetch_one(&self.db)
        .await?;

        Ok((results, count.0))
    }

    /// Search regions.
    async fn search_regions(
        &self,
        ts_query: &str,
        ilike_pattern: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let rows: Vec<(String, String, String, Option<String>, Option<String>, f32)> =
            sqlx::query_as(
                r#"
                SELECT
                    id, name, slug, description, cover_image,
                    ts_rank(
                        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')),
                        to_tsquery('english', $1)
                    ) AS rank
                FROM regions
                WHERE status = 'published'
                  AND deleted_at IS NULL
                  AND (
                      to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
                      @@ to_tsquery('english', $1)
                      OR name ILIKE $2
                      OR description ILIKE $2
                  )
                ORDER BY rank DESC
                LIMIT $3
                "#,
            )
            .bind(ts_query)
            .bind(ilike_pattern)
            .bind(limit as i64)
            .fetch_all(&self.db)
            .await?;

        let results: Vec<SearchResult> = rows
            .iter()
            .map(|(id, name, slug, desc, img, rank)| SearchResult {
                id: id.clone(),
                title: name.clone(),
                slug: slug.clone(),
                excerpt: desc.clone(),
                cover_image: img.clone(),
                result_type: "region".to_string(),
                url: format!("/regions/{}", slug),
                rank: *rank,
            })
            .collect();

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM regions
            WHERE status = 'published'
              AND deleted_at IS NULL
              AND (
                  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
                  @@ to_tsquery('english', $1)
                  OR name ILIKE $2
                  OR description ILIKE $2
              )
            "#,
        )
        .bind(ts_query)
        .bind(ilike_pattern)
        .fetch_one(&self.db)
        .await?;

        Ok((results, count.0))
    }

    /// Search videos.
    async fn search_videos(
        &self,
        ts_query: &str,
        ilike_pattern: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let rows: Vec<(String, String, String, Option<String>, Option<String>, f32)> =
            sqlx::query_as(
                r#"
                SELECT
                    id, title, slug, description, thumbnail_url,
                    ts_rank(
                        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')),
                        to_tsquery('english', $1)
                    ) AS rank
                FROM videos
                WHERE status = 'published'
                  AND deleted_at IS NULL
                  AND (
                      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                      @@ to_tsquery('english', $1)
                      OR title ILIKE $2
                      OR description ILIKE $2
                  )
                ORDER BY rank DESC
                LIMIT $3
                "#,
            )
            .bind(ts_query)
            .bind(ilike_pattern)
            .bind(limit as i64)
            .fetch_all(&self.db)
            .await?;

        let results: Vec<SearchResult> = rows
            .iter()
            .map(|(id, title, slug, desc, thumb, rank)| SearchResult {
                id: id.clone(),
                title: title.clone(),
                slug: slug.clone(),
                excerpt: desc.clone(),
                cover_image: thumb.clone(),
                result_type: "video".to_string(),
                url: format!("/videos/{}", slug),
                rank: *rank,
            })
            .collect();

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM videos
            WHERE status = 'published'
              AND deleted_at IS NULL
              AND (
                  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                  @@ to_tsquery('english', $1)
                  OR title ILIKE $2
                  OR description ILIKE $2
              )
            "#,
        )
        .bind(ts_query)
        .bind(ilike_pattern)
        .fetch_one(&self.db)
        .await?;

        Ok((results, count.0))
    }

    /// Search photo features.
    async fn search_photos(
        &self,
        ts_query: &str,
        ilike_pattern: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let rows: Vec<(String, String, String, Option<String>, f32)> = sqlx::query_as(
            r#"
                SELECT
                    id, title, slug, description,
                    ts_rank(
                        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')),
                        to_tsquery('english', $1)
                    ) AS rank
                FROM photo_features
                WHERE status = 'published'
                  AND deleted_at IS NULL
                  AND (
                      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                      @@ to_tsquery('english', $1)
                      OR title ILIKE $2
                      OR description ILIKE $2
                  )
                ORDER BY rank DESC
                LIMIT $3
                "#,
        )
        .bind(ts_query)
        .bind(ilike_pattern)
        .bind(limit as i64)
        .fetch_all(&self.db)
        .await?;

        let results: Vec<SearchResult> = rows
            .iter()
            .map(|(id, title, slug, desc, rank)| SearchResult {
                id: id.clone(),
                title: title.clone(),
                slug: slug.clone(),
                excerpt: desc.clone(),
                cover_image: None,
                result_type: "photo".to_string(),
                url: format!("/photos/{}", slug),
                rank: *rank,
            })
            .collect();

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM photo_features
            WHERE status = 'published'
              AND deleted_at IS NULL
              AND (
                  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                  @@ to_tsquery('english', $1)
                  OR title ILIKE $2
                  OR description ILIKE $2
              )
            "#,
        )
        .bind(ts_query)
        .bind(ilike_pattern)
        .fetch_one(&self.db)
        .await?;

        Ok((results, count.0))
    }

    /// Search hotels.
    async fn search_hotels(
        &self,
        ts_query: &str,
        ilike_pattern: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let rows: Vec<(String, String, String, Option<String>, Option<String>, f32)> =
            sqlx::query_as(
                r#"
                SELECT
                    id, name, slug, description, cover_image,
                    ts_rank(
                        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')),
                        to_tsquery('english', $1)
                    ) AS rank
                FROM hotels
                WHERE status = 'published'
                  AND deleted_at IS NULL
                  AND (
                      to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
                      @@ to_tsquery('english', $1)
                      OR name ILIKE $2
                      OR description ILIKE $2
                  )
                ORDER BY rank DESC
                LIMIT $3
                "#,
            )
            .bind(ts_query)
            .bind(ilike_pattern)
            .bind(limit as i64)
            .fetch_all(&self.db)
            .await?;

        let results: Vec<SearchResult> = rows
            .iter()
            .map(|(id, name, slug, desc, img, rank)| SearchResult {
                id: id.clone(),
                title: name.clone(),
                slug: slug.clone(),
                excerpt: desc.clone(),
                cover_image: img.clone(),
                result_type: "hotel".to_string(),
                url: format!("/hotels/{}", slug),
                rank: *rank,
            })
            .collect();

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM hotels
            WHERE status = 'published'
              AND deleted_at IS NULL
              AND (
                  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
                  @@ to_tsquery('english', $1)
                  OR name ILIKE $2
                  OR description ILIKE $2
              )
            "#,
        )
        .bind(ts_query)
        .bind(ilike_pattern)
        .fetch_one(&self.db)
        .await?;

        Ok((results, count.0))
    }
}

/// Build a PostgreSQL tsquery string from user input.
/// Splits on whitespace and joins with `&` (AND).
/// Sanitizes special characters that would break tsquery parsing.
/// If the input produces an empty query, returns a safe fallback.
/// Escape LIKE/ILIKE metacharacters so user input is treated literally.
///
/// PostgreSQL's `LIKE` operator treats `%` as "match any sequence" and `_` as
/// "match any single character". Without escaping, a user searching for `%`
/// would match every row, and `_` would act as a single-char wildcard.
///
/// The default escape character in PostgreSQL is `\`, so we escape `\` first
/// (to avoid double-escaping), then `%` and `_`.
fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn build_tsquery(input: &str) -> String {
    let words: Vec<String> = input
        .split_whitespace()
        .map(|w| {
            // Remove characters that are special in tsquery
            w.chars()
                .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
                .collect::<String>()
        })
        .filter(|w| !w.is_empty())
        .collect();

    if words.is_empty() {
        // Fallback: return something that won't match anything but won't error
        return "''".to_string();
    }

    // Join with & for AND semantics, append :* for prefix matching
    words
        .iter()
        .map(|w| format!("{}:*", w))
        .collect::<Vec<_>>()
        .join(" & ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_tsquery_single_word() {
        assert_eq!(build_tsquery("everest"), "everest:*");
    }

    #[test]
    fn test_build_tsquery_multiple_words() {
        assert_eq!(
            build_tsquery("everest base camp"),
            "everest:* & base:* & camp:*"
        );
    }

    #[test]
    fn test_build_tsquery_special_chars() {
        assert_eq!(build_tsquery("hello! world@#$"), "hello:* & world:*");
    }

    #[test]
    fn test_build_tsquery_empty() {
        assert_eq!(build_tsquery(""), "''");
    }

    #[test]
    fn test_build_tsquery_only_special_chars() {
        assert_eq!(build_tsquery("!@#$%"), "''");
    }
}
