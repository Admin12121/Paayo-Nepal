use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "media_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Image,
    Document,
}

impl From<&str> for MediaType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "document" => MediaType::Document,
            _ => MediaType::Image,
        }
    }
}

impl std::fmt::Display for MediaType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MediaType::Image => write!(f, "image"),
            MediaType::Document => write!(f, "document"),
        }
    }
}

/// Media record — matches the `media` table in PostgreSQL.
/// General-purpose media storage for uploaded files.
/// Videos are stored in their own `videos` table (not here).
///
/// The `url` and `thumbnail_url` fields are **computed** at serialization
/// time from `filename` and `thumbnail_path` respectively. They are NOT
/// stored in the database — they exist only in JSON responses so that
/// frontend consumers get ready-to-use URLs (e.g. `/uploads/uuid.avif`)
/// instead of having to manually construct paths from raw filenames.
#[derive(Debug, Clone, Deserialize, FromRow)]
pub struct Media {
    pub id: String,
    pub filename: String,
    pub original_name: String,
    pub mime_type: String,
    pub size: i32,
    #[sqlx(rename = "type")]
    pub media_type: MediaType,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub blur_hash: Option<String>,
    pub thumbnail_path: Option<String>,
    pub alt: Option<String>,
    pub caption: Option<String>,
    pub uploaded_by: String,
    pub created_at: DateTime<Utc>,
}

impl Media {
    /// Build the public-facing URL for the main image file.
    pub fn url(&self) -> String {
        format!("/uploads/{}", self.filename)
    }

    /// Build the public-facing URL for the thumbnail, if one exists.
    pub fn thumbnail_url(&self) -> Option<String> {
        self.thumbnail_path
            .as_ref()
            .filter(|p| !p.is_empty())
            .map(|p| format!("/uploads/{}", p))
    }
}

/// Custom `Serialize` implementation that includes the computed `url` and
/// `thumbnail_url` fields alongside all the stored columns.
///
/// This keeps the database model clean (no phantom columns) while giving
/// API consumers the convenience of pre-built URLs in every response.
impl Serialize for Media {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        // 14 stored fields + 2 computed fields = 16
        let mut state = serializer.serialize_struct("Media", 16)?;

        state.serialize_field("id", &self.id)?;
        state.serialize_field("filename", &self.filename)?;
        state.serialize_field("original_name", &self.original_name)?;
        state.serialize_field("mime_type", &self.mime_type)?;
        state.serialize_field("size", &self.size)?;
        state.serialize_field("media_type", &self.media_type)?;
        state.serialize_field("width", &self.width)?;
        state.serialize_field("height", &self.height)?;
        state.serialize_field("blur_hash", &self.blur_hash)?;
        state.serialize_field("thumbnail_path", &self.thumbnail_path)?;
        state.serialize_field("alt", &self.alt)?;
        state.serialize_field("caption", &self.caption)?;
        state.serialize_field("uploaded_by", &self.uploaded_by)?;
        state.serialize_field("created_at", &self.created_at)?;

        // Computed fields — NOT in the database, only in JSON output
        state.serialize_field("url", &self.url())?;
        state.serialize_field("thumbnail_url", &self.thumbnail_url())?;

        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_generation() {
        let media = Media {
            id: "test-id".to_string(),
            filename: "abc123.avif".to_string(),
            original_name: "photo.jpg".to_string(),
            mime_type: "image/avif".to_string(),
            size: 1024,
            media_type: MediaType::Image,
            width: Some(800),
            height: Some(600),
            blur_hash: Some("LEHV6nWB".to_string()),
            thumbnail_path: Some("abc123_thumb.avif".to_string()),
            alt: None,
            caption: None,
            uploaded_by: "user-1".to_string(),
            created_at: Utc::now(),
        };

        assert_eq!(media.url(), "/uploads/abc123.avif");
        assert_eq!(
            media.thumbnail_url(),
            Some("/uploads/abc123_thumb.avif".to_string())
        );
    }

    #[test]
    fn test_thumbnail_url_none_when_missing() {
        let media = Media {
            id: "test-id".to_string(),
            filename: "abc123.avif".to_string(),
            original_name: "photo.jpg".to_string(),
            mime_type: "image/avif".to_string(),
            size: 1024,
            media_type: MediaType::Image,
            width: None,
            height: None,
            blur_hash: None,
            thumbnail_path: None,
            alt: None,
            caption: None,
            uploaded_by: "user-1".to_string(),
            created_at: Utc::now(),
        };

        assert_eq!(media.thumbnail_url(), None);
    }

    #[test]
    fn test_thumbnail_url_none_when_empty() {
        let media = Media {
            id: "test-id".to_string(),
            filename: "abc123.avif".to_string(),
            original_name: "photo.jpg".to_string(),
            mime_type: "image/avif".to_string(),
            size: 1024,
            media_type: MediaType::Image,
            width: None,
            height: None,
            blur_hash: None,
            thumbnail_path: Some("".to_string()),
            alt: None,
            caption: None,
            uploaded_by: "user-1".to_string(),
            created_at: Utc::now(),
        };

        assert_eq!(media.thumbnail_url(), None);
    }

    #[test]
    fn test_json_includes_url_fields() {
        let media = Media {
            id: "test-id".to_string(),
            filename: "abc123.avif".to_string(),
            original_name: "photo.jpg".to_string(),
            mime_type: "image/avif".to_string(),
            size: 1024,
            media_type: MediaType::Image,
            width: Some(800),
            height: Some(600),
            blur_hash: None,
            thumbnail_path: Some("abc123_thumb.avif".to_string()),
            alt: None,
            caption: None,
            uploaded_by: "user-1".to_string(),
            created_at: Utc::now(),
        };

        let json = serde_json::to_value(&media).unwrap();
        assert_eq!(json["url"], "/uploads/abc123.avif");
        assert_eq!(json["thumbnail_url"], "/uploads/abc123_thumb.avif");
        // Original fields still present
        assert_eq!(json["filename"], "abc123.avif");
        assert_eq!(json["id"], "test-id");
    }

    #[test]
    fn test_media_type_from_str() {
        assert!(matches!(MediaType::from("image"), MediaType::Image));
        assert!(matches!(MediaType::from("document"), MediaType::Document));
        assert!(matches!(MediaType::from("IMAGE"), MediaType::Image));
        assert!(matches!(MediaType::from("DOCUMENT"), MediaType::Document));
        assert!(matches!(MediaType::from("unknown"), MediaType::Image));
    }
}
