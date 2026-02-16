use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::common::ContentStatus;

/// Hotel record — matches the `hotels` table in PostgreSQL.
/// Hotels have NO likes and NO comments per decision.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Hotel {
    pub id: String,
    pub author_id: String,
    pub region_id: Option<String>,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub star_rating: Option<i16>,
    pub price_range: Option<HotelPriceRange>,
    pub amenities: Option<sqlx::types::Json<serde_json::Value>>,
    pub cover_image: Option<String>,
    pub gallery: Option<sqlx::types::Json<serde_json::Value>>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub display_order: Option<i32>,
    pub is_featured: bool,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// HotelBranch record — matches the `hotel_branches` table in PostgreSQL.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HotelBranch {
    pub id: String,
    pub hotel_id: String,
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub coordinates: Option<sqlx::types::Json<serde_json::Value>>,
    pub is_main: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Hotel with its associated branches for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotelWithBranches {
    pub id: String,
    pub author_id: String,
    pub region_id: Option<String>,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub star_rating: Option<i16>,
    pub price_range: Option<HotelPriceRange>,
    pub amenities: Option<serde_json::Value>,
    pub cover_image: Option<String>,
    pub gallery: Option<serde_json::Value>,
    pub status: ContentStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub display_order: Option<i32>,
    pub is_featured: bool,
    pub view_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub branches: Vec<HotelBranch>,
}

impl HotelWithBranches {
    pub fn from_hotel_and_branches(hotel: Hotel, branches: Vec<HotelBranch>) -> Self {
        Self {
            id: hotel.id,
            author_id: hotel.author_id,
            region_id: hotel.region_id,
            name: hotel.name,
            slug: hotel.slug,
            description: hotel.description,
            email: hotel.email,
            phone: hotel.phone,
            website: hotel.website,
            star_rating: hotel.star_rating,
            price_range: hotel.price_range,
            amenities: hotel.amenities.map(|v| v.0),
            cover_image: hotel.cover_image,
            gallery: hotel.gallery.map(|v| v.0),
            status: hotel.status,
            published_at: hotel.published_at,
            display_order: hotel.display_order,
            is_featured: hotel.is_featured,
            view_count: hotel.view_count,
            created_at: hotel.created_at,
            updated_at: hotel.updated_at,
            deleted_at: hotel.deleted_at,
            branches,
        }
    }
}

/// Price range enum for validation
///
/// Maps to PostgreSQL enum: `hotel_price_range AS ENUM ('budget', 'mid', 'luxury')`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "hotel_price_range", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum HotelPriceRange {
    Budget,
    Mid,
    Luxury,
}

impl From<&str> for HotelPriceRange {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "mid" => HotelPriceRange::Mid,
            "luxury" => HotelPriceRange::Luxury,
            _ => HotelPriceRange::Budget,
        }
    }
}

impl std::fmt::Display for HotelPriceRange {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HotelPriceRange::Budget => write!(f, "budget"),
            HotelPriceRange::Mid => write!(f, "mid"),
            HotelPriceRange::Luxury => write!(f, "luxury"),
        }
    }
}
