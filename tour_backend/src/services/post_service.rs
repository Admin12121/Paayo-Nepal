use chrono::Utc;
use sqlx::MySqlPool;
use uuid::Uuid;

use crate::{
    error::ApiError, models::post::Post, services::CacheService, utils::slug::generate_slug,
};

pub struct PostService {
    db: MySqlPool,
    cache: CacheService,
}

impl PostService {
    pub fn new(db: MySqlPool, cache: CacheService) -> Self {
        Self { db, cache }
    }

    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        status: Option<&str>,
        post_type: Option<&str>,
        author_id: Option<&str>,
    ) -> Result<(Vec<Post>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut query = String::from("SELECT * FROM posts WHERE 1=1");
        let mut count_query = String::from("SELECT COUNT(*) as count FROM posts WHERE 1=1");
        let mut binds: Vec<String> = Vec::new();

        if let Some(s) = status {
            query.push_str(" AND status = ?");
            count_query.push_str(" AND status = ?");
            binds.push(s.to_string());
        }

        if let Some(t) = post_type {
            query.push_str(" AND type = ?");
            count_query.push_str(" AND type = ?");
            binds.push(t.to_string());
        }

        if let Some(a) = author_id {
            query.push_str(" AND author_id = ?");
            count_query.push_str(" AND author_id = ?");
            binds.push(a.to_string());
        }

        query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

        // Build and execute the data query
        let mut data_q = sqlx::query_as::<_, Post>(&query);
        for b in &binds {
            data_q = data_q.bind(b);
        }
        data_q = data_q.bind(limit).bind(offset);
        let posts: Vec<Post> = data_q.fetch_all(&self.db).await?;

        // Build and execute the count query
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_query);
        for b in &binds {
            count_q = count_q.bind(b);
        }
        let total: (i64,) = count_q.fetch_one(&self.db).await?;

        Ok((posts, total.0))
    }

    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Post>, ApiError> {
        let post = sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.db)
            .await?;

        Ok(post)
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<Post>, ApiError> {
        let post = sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(post)
    }

    pub async fn create(
        &self,
        title: &str,
        excerpt: Option<&str>,
        content: &str,
        featured_image: Option<&str>,
        post_type: &str,
        author_id: &str,
        tags: Option<&[String]>,
        meta_title: Option<&str>,
        meta_description: Option<&str>,
    ) -> Result<Post, ApiError> {
        let id = Uuid::new_v4().to_string();
        let slug = generate_slug(title);
        let tags_json = tags.map(|t| serde_json::to_string(t).unwrap_or_default());

        sqlx::query(
            r#"
            INSERT INTO posts (id, slug, title, excerpt, content, featured_image, type, status, author_id, tags, meta_title, meta_description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(&slug)
        .bind(title)
        .bind(excerpt)
        .bind(content)
        .bind(featured_image)
        .bind(post_type)
        .bind(author_id)
        .bind(&tags_json)
        .bind(meta_title)
        .bind(meta_description)
        .execute(&self.db)
        .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn update(
        &self,
        id: &str,
        title: Option<&str>,
        excerpt: Option<&str>,
        content: Option<&str>,
        featured_image: Option<&str>,
        tags: Option<&[String]>,
        meta_title: Option<&str>,
        meta_description: Option<&str>,
    ) -> Result<Post, ApiError> {
        let existing = self
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))?;

        let new_title = title.unwrap_or(&existing.title);
        let new_slug = if title.is_some() {
            generate_slug(new_title)
        } else {
            existing.slug.clone()
        };
        let tags_json = tags.map(|t| serde_json::to_string(t).unwrap_or_default());

        sqlx::query(
            r#"
            UPDATE posts SET
                slug = COALESCE(?, slug),
                title = COALESCE(?, title),
                excerpt = COALESCE(?, excerpt),
                content = COALESCE(?, content),
                featured_image = COALESCE(?, featured_image),
                tags = COALESCE(?, tags),
                meta_title = COALESCE(?, meta_title),
                meta_description = COALESCE(?, meta_description),
                updated_at = NOW()
            WHERE id = ?
            "#,
        )
        .bind(if title.is_some() {
            Some(&new_slug)
        } else {
            None
        })
        .bind(title)
        .bind(excerpt)
        .bind(content)
        .bind(featured_image)
        .bind(&tags_json)
        .bind(meta_title)
        .bind(meta_description)
        .bind(id)
        .execute(&self.db)
        .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;
        let _ = self
            .cache
            .delete(&format!("post:slug:{}", existing.slug))
            .await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::InternalServerError)
    }

    pub async fn delete(&self, id: &str) -> Result<(), ApiError> {
        let existing = self.get_by_id(id).await?;

        sqlx::query("DELETE FROM posts WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;
        if let Some(post) = existing {
            let _ = self.cache.delete(&format!("post:slug:{}", post.slug)).await;
        }

        Ok(())
    }

    pub async fn update_status(&self, id: &str, status: &str) -> Result<Post, ApiError> {
        let published_at = if status == "published" {
            Some(Utc::now())
        } else {
            None
        };

        sqlx::query(
            "UPDATE posts SET status = ?, published_at = COALESCE(?, published_at), updated_at = NOW() WHERE id = ?"
        )
        .bind(status)
        .bind(published_at)
        .bind(id)
        .execute(&self.db)
        .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))
    }

    pub async fn approve(&self, id: &str, approved_by: &str) -> Result<Post, ApiError> {
        sqlx::query(
            "UPDATE posts SET status = 'published', approved_by = ?, approved_at = NOW(), published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = ?"
        )
        .bind(approved_by)
        .bind(id)
        .execute(&self.db)
        .await?;

        // Invalidate cache
        let _ = self.cache.invalidate("posts:*").await;

        self.get_by_id(id)
            .await?
            .ok_or_else(|| ApiError::NotFound("Post not found".to_string()))
    }
}
