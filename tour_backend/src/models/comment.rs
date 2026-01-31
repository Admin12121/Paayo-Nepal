use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Comment {
    pub id: String,
    pub post_id: String,
    pub user_id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub likes: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommentLike {
    pub id: String,
    pub comment_id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentWithUser {
    pub id: String,
    pub post_id: String,
    pub user_id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub likes: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_name: Option<String>,
    pub user_image: Option<String>,
    pub replies: Vec<CommentWithUser>,
}
