use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub email_verified: bool,
    pub name: Option<String>,
    pub image: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub banned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserRole {
    Admin,
    Editor,
    User,
}

impl From<&str> for UserRole {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "admin" => UserRole::Admin,
            "editor" => UserRole::Editor,
            _ => UserRole::User,
        }
    }
}

impl From<String> for UserRole {
    fn from(s: String) -> Self {
        UserRole::from(s.as_str())
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Admin => write!(f, "admin"),
            UserRole::Editor => write!(f, "editor"),
            UserRole::User => write!(f, "user"),
        }
    }
}
