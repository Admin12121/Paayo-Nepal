use serde::{Deserialize, Serialize};

/// Shared content status enum — maps to the PostgreSQL `content_status` enum.
///
/// Used by: posts, videos, regions, hotels, photo_features.
///
/// ```sql
/// CREATE TYPE content_status AS ENUM ('draft', 'published');
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "content_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ContentStatus {
    Draft,
    Published,
}

impl ContentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ContentStatus::Draft => "draft",
            ContentStatus::Published => "published",
        }
    }

    pub fn is_published(&self) -> bool {
        matches!(self, ContentStatus::Published)
    }

    pub fn is_draft(&self) -> bool {
        matches!(self, ContentStatus::Draft)
    }
}

impl From<&str> for ContentStatus {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "published" => ContentStatus::Published,
            _ => ContentStatus::Draft,
        }
    }
}

impl std::fmt::Display for ContentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
