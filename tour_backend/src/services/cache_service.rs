use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

#[derive(Clone)]
pub struct CacheService {
    redis: redis::aio::ConnectionManager,
}

impl CacheService {
    pub fn new(redis: redis::aio::ConnectionManager) -> Self {
        Self { redis }
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let mut conn = self.redis.clone();
        let result: Option<String> = conn.get(key).await.ok()?;
        result.and_then(|s| serde_json::from_str(&s).ok())
    }

    pub async fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> anyhow::Result<()> {
        let mut conn = self.redis.clone();
        let serialized = serde_json::to_string(value)?;
        conn.set_ex::<_, _, ()>(key, serialized, ttl.as_secs())
            .await?;
        Ok(())
    }

    pub async fn delete(&self, key: &str) -> anyhow::Result<()> {
        let mut conn = self.redis.clone();
        conn.del::<_, ()>(key).await?;
        Ok(())
    }

    pub async fn invalidate(&self, pattern: &str) -> anyhow::Result<()> {
        let mut conn = self.redis.clone();
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(pattern)
            .query_async(&mut conn)
            .await?;

        if !keys.is_empty() {
            conn.del::<_, ()>(keys).await?;
        }
        Ok(())
    }

    /// Cache-aside pattern: get from cache or fetch and cache
    pub async fn get_or_set<T, F, Fut>(
        &self,
        key: &str,
        ttl: Duration,
        fetch: F,
    ) -> anyhow::Result<T>
    where
        T: Serialize + DeserializeOwned,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = anyhow::Result<T>>,
    {
        if let Some(cached) = self.get::<T>(key).await {
            return Ok(cached);
        }

        let value = fetch().await?;
        self.set(key, &value, ttl).await?;
        Ok(value)
    }
}

/// Cache key generators
pub mod keys {
    pub fn post_by_slug(slug: &str) -> String {
        format!("post:slug:{}", slug)
    }

    pub fn post_by_id(id: &str) -> String {
        format!("post:id:{}", id)
    }

    pub fn posts_list(page: i32, limit: i32, status: Option<&str>) -> String {
        format!("posts:list:{}:{}:{}", page, limit, status.unwrap_or("all"))
    }

    pub fn attractions_top() -> String {
        "attractions:top".to_string()
    }

    pub fn attraction_by_slug(slug: &str) -> String {
        format!("attraction:slug:{}", slug)
    }

    pub fn region_by_slug(slug: &str) -> String {
        format!("region:slug:{}", slug)
    }

    pub fn event_by_slug(slug: &str) -> String {
        format!("event:slug:{}", slug)
    }

    pub fn activity_by_slug(slug: &str) -> String {
        format!("activity:slug:{}", slug)
    }

    pub fn gallery(page: i32, limit: i32) -> String {
        format!("gallery:{}:{}", page, limit)
    }

    pub fn search(query: &str, search_type: &str) -> String {
        format!("search:{}:{}", search_type, query)
    }
}
