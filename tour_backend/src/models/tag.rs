use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Tag record — matches the `tags` table in PostgreSQL.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub tag_type: TagType,
    pub created_at: DateTime<Utc>,
}

/// ContentTag record — matches the `content_tags` junction table in PostgreSQL.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContentTag {
    pub id: String,
    pub tag_id: String,
    pub target_type: ContentTagTarget,
    pub target_id: String,
}

/// Tag type enum for validation
///
/// Maps to PostgreSQL enum: `tag_type AS ENUM ('activity', 'category', 'general')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "tag_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TagType {
    Activity,
    Category,
    General,
}

impl From<&str> for TagType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "activity" => TagType::Activity,
            "category" => TagType::Category,
            _ => TagType::General,
        }
    }
}

impl std::fmt::Display for TagType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TagType::Activity => write!(f, "activity"),
            TagType::Category => write!(f, "category"),
            TagType::General => write!(f, "general"),
        }
    }
}

/// Content tag target types
///
/// Maps to PostgreSQL enum: `content_tag_target AS ENUM ('post', 'video', 'photo', 'hotel')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "content_tag_target", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ContentTagTarget {
    Post,
    Video,
    Photo,
    Hotel,
}

impl From<&str> for ContentTagTarget {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "video" => ContentTagTarget::Video,
            "photo" => ContentTagTarget::Photo,
            "hotel" => ContentTagTarget::Hotel,
            _ => ContentTagTarget::Post,
        }
    }
}

impl std::fmt::Display for ContentTagTarget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContentTagTarget::Post => write!(f, "post"),
            ContentTagTarget::Video => write!(f, "video"),
            ContentTagTarget::Photo => write!(f, "photo"),
            ContentTagTarget::Hotel => write!(f, "hotel"),
        }
    }
}

/// Tag with usage count for admin/listing views
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TagWithCount {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub tag_type: TagType,
    pub created_at: DateTime<Utc>,
    pub usage_count: i64,
}
