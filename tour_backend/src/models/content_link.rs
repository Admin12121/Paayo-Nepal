use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Allowed source types for content links.
///
/// Matches the PostgreSQL enum: `content_link_source AS ENUM ('post', 'region')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "content_link_source", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ContentLinkSource {
    Post,
    Region,
}

impl ContentLinkSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Post => "post",
            Self::Region => "region",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "post" => Some(Self::Post),
            "region" => Some(Self::Region),
            _ => None,
        }
    }

    /// All valid source type strings (for error messages).
    pub const VALID: &'static [&'static str] = &["post", "region"];
}

impl std::fmt::Display for ContentLinkSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Allowed target types for content links.
///
/// Matches the PostgreSQL enum: `content_link_target AS ENUM ('photo', 'video', 'post')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "content_link_target", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ContentLinkTarget {
    Photo,
    Video,
    Post,
}

impl ContentLinkTarget {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Photo => "photo",
            Self::Video => "video",
            Self::Post => "post",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "photo" => Some(Self::Photo),
            "video" => Some(Self::Video),
            "post" => Some(Self::Post),
            _ => None,
        }
    }

    /// All valid target type strings (for error messages).
    pub const VALID: &'static [&'static str] = &["photo", "video", "post"];
}

impl std::fmt::Display for ContentLinkTarget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A row in the `content_links` table.
///
/// Content links form a many-to-many relationship between source content
/// (posts, regions) and target content (photos, videos, other posts).
/// They are used to surface "related content" on detail pages.
///
/// ## Table schema
///
/// ```sql
/// CREATE TABLE content_links (
///     id            VARCHAR(36) PRIMARY KEY,
///     source_type   content_link_source NOT NULL,
///     source_id     VARCHAR(36) NOT NULL,
///     target_type   content_link_target NOT NULL,
///     target_id     VARCHAR(36) NOT NULL,
///     display_order INTEGER DEFAULT 0,
///     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
/// );
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContentLink {
    pub id: String,
    pub source_type: ContentLinkSource,
    pub source_id: String,
    pub target_type: ContentLinkTarget,
    pub target_id: String,
    pub display_order: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Input for creating a new content link.
#[derive(Debug, Deserialize)]
pub struct CreateContentLinkInput {
    pub source_type: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub display_order: Option<i32>,
}

/// Input for updating display order of a content link.
#[derive(Debug, Deserialize)]
pub struct UpdateContentLinkInput {
    pub display_order: Option<i32>,
}

/// Input for batch-setting content links for a source item.
///
/// Replaces all existing links for the given source with the provided list.
#[derive(Debug, Deserialize)]
pub struct SetContentLinksInput {
    pub links: Vec<SetContentLinkItem>,
}

/// A single item in a batch set-links request.
#[derive(Debug, Deserialize)]
pub struct SetContentLinkItem {
    pub target_type: String,
    pub target_id: String,
    pub display_order: Option<i32>,
}
