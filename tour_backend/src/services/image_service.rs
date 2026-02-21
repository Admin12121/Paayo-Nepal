use anyhow::{Context, Result};
use aws_config::{meta::region::RegionProviderChain, BehaviorVersion};
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Region, primitives::ByteStream, Client as S3Client};
use blurhash::encode;
use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageReader};
use std::io::Cursor;
use std::path::PathBuf;
use tokio::fs;
use tracing::{info, warn};

use crate::config::{MediaConfig, MediaStorage};

enum StorageBackend {
    Local {
        upload_path: PathBuf,
    },
    S3 {
        client: S3Client,
        bucket: String,
        key_prefix: String,
    },
}

pub struct ImageService {
    storage: StorageBackend,
    max_width: u32,
    max_height: u32,
    thumbnail_width: u32,
    thumbnail_height: u32,
    avif_quality: u8,
    avif_speed: u8,
}

#[derive(Debug, Clone)]
pub struct ProcessedImage {
    pub filename: String,
    pub thumbnail_filename: String,
    pub width: u32,
    pub height: u32,
    pub blur_hash: String,
    pub size: u64,
    pub mime_type: String,
}

impl ImageService {
    pub async fn from_config(config: &MediaConfig) -> Result<Self> {
        let storage = match config.storage {
            MediaStorage::Local => StorageBackend::Local {
                upload_path: config.upload_path.clone().into(),
            },
            MediaStorage::S3 => {
                let s3 = config
                    .s3
                    .as_ref()
                    .context("S3 config missing while MEDIA_STORAGE=s3")?;

                let credentials = Credentials::new(
                    s3.access_key_id.clone(),
                    s3.secret_access_key.clone(),
                    s3.session_token.clone(),
                    None,
                    "env",
                );

                let region = Region::new(s3.region.clone());
                let region_provider = RegionProviderChain::first_try(region.clone());

                let shared_config = aws_config::defaults(BehaviorVersion::latest())
                    .region(region_provider)
                    .credentials_provider(credentials)
                    .load()
                    .await;

                let mut builder = aws_sdk_s3::config::Builder::from(&shared_config)
                    .region(region)
                    .force_path_style(s3.force_path_style);

                if let Some(endpoint) = s3.endpoint.as_deref() {
                    builder = builder.endpoint_url(normalize_endpoint(endpoint));
                }

                let client = S3Client::from_conf(builder.build());

                StorageBackend::S3 {
                    client,
                    bucket: s3.bucket.clone(),
                    key_prefix: s3.key_prefix.trim_matches('/').to_string(),
                }
            }
        };

        Ok(Self {
            storage,
            max_width: config.max_image_width,
            max_height: config.max_image_width,
            thumbnail_width: config.thumbnail_width,
            thumbnail_height: config.thumbnail_width,
            avif_quality: 75, // 0-100, higher = better quality
            avif_speed: 8,    // 1-10, higher = faster encoding
        })
    }

    /// Process uploaded image: resize, convert to AVIF, generate thumbnail and blur hash.
    ///
    /// All CPU-intensive work (decode, resize, encode, blur hash) is offloaded to
    /// `tokio::task::spawn_blocking` so the async runtime is never blocked.
    pub async fn process_image(
        &self,
        image_data: &[u8],
        original_filename: &str,
    ) -> Result<ProcessedImage> {
        let data = image_data.to_vec();
        let filename = original_filename.to_string();
        let max_w = self.max_width;
        let max_h = self.max_height;
        let thumb_w = self.thumbnail_width;
        let thumb_h = self.thumbnail_height;
        let quality = self.avif_quality;
        let speed = self.avif_speed;

        // Offload all CPU-intensive work to a blocking thread.
        let result = tokio::task::spawn_blocking(move || -> Result<ProcessedImageIntermediate> {
            let img = ImageReader::new(Cursor::new(&data))
                .with_guessed_format()
                .context("Failed to guess image format")?
                .decode()
                .context("Failed to decode image")?;

            info!(
                "Processing image: {} ({}x{})",
                filename,
                img.width(),
                img.height()
            );

            let file_id = uuid::Uuid::new_v4().to_string();
            let out_filename = format!("{}.avif", file_id);
            let thumbnail_filename = format!("{}_thumb.avif", file_id);

            let resized = resize_image(&img, max_w, max_h);
            let (width, height) = (resized.width(), resized.height());

            let blur_hash = generate_blur_hash(&resized)?;
            let avif_data = encode_avif(&resized, quality, speed)?;
            info!(
                "Encoded main image: {} ({}x{}, {} bytes)",
                out_filename,
                width,
                height,
                avif_data.len()
            );

            let thumbnail = resize_image(&img, thumb_w, thumb_h);
            info!(
                "Resized thumbnail from {}x{} to {}x{}",
                img.width(),
                img.height(),
                thumbnail.width(),
                thumbnail.height()
            );
            let thumbnail_data = encode_avif(&thumbnail, quality, speed)?;
            let size = avif_data.len() as u64;

            Ok(ProcessedImageIntermediate {
                filename: out_filename,
                thumbnail_filename,
                width,
                height,
                blur_hash,
                size,
                avif_data,
                thumbnail_data,
            })
        })
        .await
        .context("Image processing task panicked")??;

        self.persist_processed_files(&result).await?;

        Ok(ProcessedImage {
            filename: result.filename,
            thumbnail_filename: result.thumbnail_filename,
            width: result.width,
            height: result.height,
            blur_hash: result.blur_hash,
            size: result.size,
            mime_type: "image/avif".to_string(),
        })
    }

    async fn persist_processed_files(&self, result: &ProcessedImageIntermediate) -> Result<()> {
        match &self.storage {
            StorageBackend::Local { upload_path } => {
                let file_path = upload_path.join(&result.filename);
                fs::write(&file_path, &result.avif_data)
                    .await
                    .context("Failed to write AVIF file")?;
                info!("Saved main image: {}", result.filename);

                let thumbnail_path = upload_path.join(&result.thumbnail_filename);
                fs::write(&thumbnail_path, &result.thumbnail_data)
                    .await
                    .context("Failed to write thumbnail")?;
                info!("Saved thumbnail: {}", result.thumbnail_filename);
            }
            StorageBackend::S3 {
                client,
                bucket,
                key_prefix,
            } => {
                let file_key = object_key(key_prefix, &result.filename);
                client
                    .put_object()
                    .bucket(bucket)
                    .key(&file_key)
                    .content_type("image/avif")
                    .body(ByteStream::from(result.avif_data.clone()))
                    .send()
                    .await
                    .context("Failed to upload main image to S3")?;
                info!("Uploaded main image to object storage: {}", file_key);

                let thumbnail_key = object_key(key_prefix, &result.thumbnail_filename);
                client
                    .put_object()
                    .bucket(bucket)
                    .key(&thumbnail_key)
                    .content_type("image/avif")
                    .body(ByteStream::from(result.thumbnail_data.clone()))
                    .send()
                    .await
                    .context("Failed to upload thumbnail to S3")?;
                info!("Uploaded thumbnail to object storage: {}", thumbnail_key);
            }
        }

        Ok(())
    }

    /// Delete image files.
    pub async fn delete_image(&self, filename: &str, thumbnail_filename: &str) -> Result<()> {
        match &self.storage {
            StorageBackend::Local { upload_path } => {
                let file_path = upload_path.join(filename);
                let thumbnail_path = upload_path.join(thumbnail_filename);

                if file_path.exists() {
                    fs::remove_file(&file_path)
                        .await
                        .context("Failed to delete image file")?;
                    info!("Deleted image: {}", filename);
                } else {
                    warn!("Image file not found: {}", filename);
                }

                if !thumbnail_filename.is_empty() && thumbnail_path.exists() {
                    fs::remove_file(&thumbnail_path)
                        .await
                        .context("Failed to delete thumbnail")?;
                    info!("Deleted thumbnail: {}", thumbnail_filename);
                } else if !thumbnail_filename.is_empty() {
                    warn!("Thumbnail not found: {}", thumbnail_filename);
                }
            }
            StorageBackend::S3 {
                client,
                bucket,
                key_prefix,
            } => {
                let file_key = object_key(key_prefix, filename);
                client
                    .delete_object()
                    .bucket(bucket)
                    .key(&file_key)
                    .send()
                    .await
                    .context("Failed to delete main object from S3")?;
                info!("Deleted object from storage: {}", file_key);

                if !thumbnail_filename.is_empty() {
                    let thumbnail_key = object_key(key_prefix, thumbnail_filename);
                    client
                        .delete_object()
                        .bucket(bucket)
                        .key(&thumbnail_key)
                        .send()
                        .await
                        .context("Failed to delete thumbnail object from S3")?;
                    info!("Deleted object from storage: {}", thumbnail_key);
                }
            }
        }

        Ok(())
    }

    /// Verify upload directory exists (local storage only).
    pub async fn ensure_upload_dir(&self) -> Result<()> {
        if let StorageBackend::Local { upload_path } = &self.storage {
            fs::create_dir_all(upload_path)
                .await
                .context("Failed to create upload directory")?;
        }
        Ok(())
    }

    /// Whether this service serves files from local disk.
    pub fn uses_local_filesystem(&self) -> bool {
        matches!(self.storage, StorageBackend::Local { .. })
    }

    /// Get image path (local only; for S3 this returns the object key path).
    pub fn get_image_path(&self, filename: &str) -> PathBuf {
        match &self.storage {
            StorageBackend::Local { upload_path } => upload_path.join(filename),
            StorageBackend::S3 { key_prefix, .. } => {
                PathBuf::from(object_key(key_prefix, filename))
            }
        }
    }
}

/// Intermediate result from the blocking thread, carries encoded bytes
/// so the async side can write them to storage.
struct ProcessedImageIntermediate {
    filename: String,
    thumbnail_filename: String,
    width: u32,
    height: u32,
    blur_hash: String,
    size: u64,
    avif_data: Vec<u8>,
    thumbnail_data: Vec<u8>,
}

fn normalize_endpoint(raw: &str) -> String {
    let endpoint = raw.trim().trim_end_matches('/');
    if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
        endpoint.to_string()
    } else {
        format!("https://{}", endpoint)
    }
}

fn object_key(prefix: &str, filename: &str) -> String {
    let p = prefix.trim_matches('/');
    if p.is_empty() {
        filename.to_string()
    } else {
        format!("{}/{}", p, filename)
    }
}

/// Resize image maintaining aspect ratio. Returns the original if already within limits.
fn resize_image(img: &DynamicImage, max_width: u32, max_height: u32) -> DynamicImage {
    let (width, height) = img.dimensions();

    if width <= max_width && height <= max_height {
        return img.clone();
    }

    let width_ratio = max_width as f32 / width as f32;
    let height_ratio = max_height as f32 / height as f32;
    let ratio = width_ratio.min(height_ratio);

    let new_width = (width as f32 * ratio) as u32;
    let new_height = (height as f32 * ratio) as u32;

    info!(
        "Resizing image from {}x{} to {}x{}",
        width, height, new_width, new_height
    );

    img.resize(new_width, new_height, FilterType::CatmullRom)
}

/// Generate blur hash for placeholder image.
fn generate_blur_hash(img: &DynamicImage) -> Result<String> {
    let small = img.resize_exact(32, 32, FilterType::Triangle);
    let rgba = small.to_rgba8();
    let (width, height) = small.dimensions();

    let hash =
        encode(4, 3, width, height, &rgba.into_raw()).context("Failed to generate blur hash")?;

    Ok(hash)
}

/// Encode image as AVIF with the given quality and speed settings.
fn encode_avif(img: &DynamicImage, quality: u8, speed: u8) -> Result<Vec<u8>> {
    let rgba = img.to_rgba8();
    let (width, height) = img.dimensions();

    let encoder = ravif::Encoder::new()
        .with_quality(quality as f32)
        .with_speed(speed)
        .with_alpha_quality(quality as f32);

    let rgba_pixels: Vec<ravif::RGBA8> = rgba.as_raw().as_rgba();
    let img_data = ravif::Img::new(rgba_pixels.as_slice(), width as usize, height as usize);

    let encoded = encoder
        .encode_rgba(img_data)
        .map_err(|e| anyhow::anyhow!("AVIF encoding failed: {}", e))?;

    Ok(encoded.avif_file)
}

trait AsRgba {
    fn as_rgba(&self) -> Vec<ravif::RGBA8>;
}

impl AsRgba for [u8] {
    fn as_rgba(&self) -> Vec<ravif::RGBA8> {
        self.chunks_exact(4)
            .map(|chunk| ravif::RGBA8::new(chunk[0], chunk[1], chunk[2], chunk[3]))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::MediaStorage;

    #[tokio::test]
    async fn test_image_service_creation_local() {
        let service = ImageService::from_config(&MediaConfig {
            storage: MediaStorage::Local,
            upload_path: "/tmp/uploads".to_string(),
            max_upload_size: 50 * 1024 * 1024,
            max_image_width: 1920,
            thumbnail_width: 400,
            s3: None,
        })
        .await
        .unwrap();

        assert_eq!(service.max_width, 1920);
        assert_eq!(service.thumbnail_width, 400);
        assert_eq!(service.avif_speed, 8);
        assert!(service.uses_local_filesystem());
    }
}
