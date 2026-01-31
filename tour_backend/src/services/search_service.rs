use sqlx::MySqlPool;

use crate::{error::ApiError, handlers::search::SearchResult, services::CacheService};

pub struct SearchService {
    db: MySqlPool,
    cache: CacheService,
}

impl SearchService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn search(
        &self,
        query: &str,
        search_type: &str,
        limit: i32,
    ) -> Result<(Vec<SearchResult>, i64), ApiError> {
        let search_pattern = format!("%{}%", query);
        let mut results = Vec::new();
        let mut total: i64 = 0;

        // Search posts
        if search_type == "all" || search_type == "posts" {
            let posts: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT id, title, slug, excerpt, featured_image FROM posts WHERE status = 'published' AND (title LIKE ? OR content LIKE ? OR excerpt LIKE ?) LIMIT ?"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(limit)
            .fetch_all(&self.db)
            .await?;

            for (id, title, slug, excerpt, featured_image) in posts {
                results.push(SearchResult {
                    id,
                    title,
                    slug: slug.clone(),
                    excerpt,
                    featured_image,
                    result_type: "post".to_string(),
                    url: format!("/blogs/{}", slug),
                });
            }

            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM posts WHERE status = 'published' AND (title LIKE ? OR content LIKE ? OR excerpt LIKE ?)"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(&search_pattern)
            .fetch_one(&self.db)
            .await?;
            total += count.0;
        }

        // Search events
        if search_type == "all" || search_type == "events" {
            let events: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT id, title, slug, description, featured_image FROM events WHERE title LIKE ? OR description LIKE ? LIMIT ?"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(limit)
            .fetch_all(&self.db)
            .await?;

            for (id, title, slug, description, featured_image) in events {
                results.push(SearchResult {
                    id,
                    title,
                    slug: slug.clone(),
                    excerpt: description,
                    featured_image,
                    result_type: "event".to_string(),
                    url: format!("/events/{}", slug),
                });
            }

            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM events WHERE title LIKE ? OR description LIKE ?",
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .fetch_one(&self.db)
            .await?;
            total += count.0;
        }

        // Search attractions
        if search_type == "all" || search_type == "attractions" {
            let attractions: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT id, name, slug, description, featured_image FROM attractions WHERE name LIKE ? OR description LIKE ? LIMIT ?"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(limit)
            .fetch_all(&self.db)
            .await?;

            for (id, name, slug, description, featured_image) in attractions {
                results.push(SearchResult {
                    id,
                    title: name,
                    slug: slug.clone(),
                    excerpt: description,
                    featured_image,
                    result_type: "attraction".to_string(),
                    url: format!("/attractions/{}", slug),
                });
            }

            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM attractions WHERE name LIKE ? OR description LIKE ?",
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .fetch_one(&self.db)
            .await?;
            total += count.0;
        }

        // Search activities
        if search_type == "all" || search_type == "activities" {
            let activities: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT id, name, slug, description, featured_image FROM activities WHERE is_active = true AND (name LIKE ? OR description LIKE ?) LIMIT ?"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(limit)
            .fetch_all(&self.db)
            .await?;

            for (id, name, slug, description, featured_image) in activities {
                results.push(SearchResult {
                    id,
                    title: name,
                    slug: slug.clone(),
                    excerpt: description,
                    featured_image,
                    result_type: "activity".to_string(),
                    url: format!("/activities/{}", slug),
                });
            }

            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM activities WHERE is_active = true AND (name LIKE ? OR description LIKE ?)"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .fetch_one(&self.db)
            .await?;
            total += count.0;
        }

        // Search regions
        if search_type == "all" || search_type == "regions" {
            let regions: Vec<(String, String, String, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT id, name, slug, description, featured_image FROM regions WHERE name LIKE ? OR description LIKE ? LIMIT ?"
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(limit)
            .fetch_all(&self.db)
            .await?;

            for (id, name, slug, description, featured_image) in regions {
                results.push(SearchResult {
                    id,
                    title: name,
                    slug: slug.clone(),
                    excerpt: description,
                    featured_image,
                    result_type: "region".to_string(),
                    url: format!("/regions/{}", slug),
                });
            }

            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM regions WHERE name LIKE ? OR description LIKE ?",
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .fetch_one(&self.db)
            .await?;
            total += count.0;
        }

        // Limit total results
        results.truncate(limit as usize);

        Ok((results, total))
    }
}
