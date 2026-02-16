use super::{DatabaseConfig, RedisConfig};
use anyhow::Result;

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
}

#[derive(Debug, Clone)]
pub struct MediaConfig {
    pub upload_path: String,
    pub max_upload_size: usize,
    pub max_image_width: u32,
    pub thumbnail_width: u32,
}

#[derive(Debug, Clone)]
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct AdminConfig {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct Settings {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub media: MediaConfig,
    pub cors: CorsConfig,
    pub admin: AdminConfig,
}

impl Settings {
    pub fn new() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            server: ServerConfig {
                port: std::env::var("PORT")
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()
                    .unwrap_or(8080),
                host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            },
            database: DatabaseConfig {
                url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
                max_connections: std::env::var("DATABASE_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "20".to_string())
                    .parse()
                    .unwrap_or(20),
                min_connections: std::env::var("DATABASE_MIN_CONNECTIONS")
                    .unwrap_or_else(|_| "5".to_string())
                    .parse()
                    .unwrap_or(5),
            },
            redis: RedisConfig {
                url: std::env::var("REDIS_URL")
                    .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            },
            media: MediaConfig {
                upload_path: std::env::var("UPLOAD_PATH")
                    .unwrap_or_else(|_| "./uploads".to_string()),
                max_upload_size: std::env::var("MAX_UPLOAD_SIZE")
                    .unwrap_or_else(|_| "52428800".to_string())
                    .parse()
                    .unwrap_or(52428800), // 50MB default
                max_image_width: std::env::var("MAX_IMAGE_WIDTH")
                    .unwrap_or_else(|_| "1920".to_string())
                    .parse()
                    .unwrap_or(1920),
                thumbnail_width: std::env::var("THUMBNAIL_WIDTH")
                    .unwrap_or_else(|_| "400".to_string())
                    .parse()
                    .unwrap_or(400),
            },
            cors: CorsConfig {
                allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:3000,http://localhost".to_string())
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect(),
            },
            admin: AdminConfig {
                email: std::env::var("ADMIN_EMAIL")
                    .unwrap_or_else(|_| "admin@paayonepal.com".to_string()),
                password: std::env::var("ADMIN_PASSWORD")
                    .expect("ADMIN_PASSWORD must be set in environment variables"),
                name: std::env::var("ADMIN_NAME").unwrap_or_else(|_| "Admin".to_string()),
            },
        })
    }
}
