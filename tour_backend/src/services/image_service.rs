use anyhow::{Context, Result};
use blurhash::encode;
use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageReader};
use std::io::Cursor;
use std::path::PathBuf;
use tokio::fs;
use tracing::{info, warn};

pub struct ImageService {
    upload_path: PathBuf,
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
    pub fn new(upload_path: PathBuf) -> Self {
        Self {
            upload_path,
            max_width: 1920,
            max_height: 1920,
            thumbnail_width: 400,
            thumbnail_height: 400,
            avif_quality: 75, // 0-100, higher = better quality
            avif_speed: 8,    // 1-10, higher = faster encoding (was 4, now 8 for ~4-8x speedup)
        }
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
        let upload_path = self.upload_path.clone();

        // Offload ALL CPU-intensive work to a blocking thread so we don't
        // starve the async executor. This is where the 80-second stall lived.
        let result = tokio::task::spawn_blocking(move || -> Result<ProcessedImageIntermediate> {
            // Load image
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

            // Generate unique filename
            let file_id = uuid::Uuid::new_v4().to_string();
            let out_filename = format!("{}.avif", file_id);
            let thumbnail_filename = format!("{}_thumb.avif", file_id);

            // Resize main image if needed (maintain aspect ratio)
            let resized = resize_image(&img, max_w, max_h);
            let (width, height) = (resized.width(), resized.height());

            // Generate blur hash (sample to 32x32 for performance)
            let blur_hash = generate_blur_hash(&resized)?;

            // Encode main image as AVIF
            let avif_data = encode_avif(&resized, quality, speed)?;
            info!(
                "Encoded main image: {} ({}x{}, {} bytes)",
                out_filename,
                width,
                height,
                avif_data.len()
            );

            // Generate and encode thumbnail
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
                upload_path,
            })
        })
        .await
        .context("Image processing task panicked")??;

        // Write files to disk (async I/O — cheap, doesn't block the executor)
        let file_path = result.upload_path.join(&result.filename);
        fs::write(&file_path, &result.avif_data)
            .await
            .context("Failed to write AVIF file")?;
        info!("Saved main image: {}", result.filename);

        let thumbnail_path = result.upload_path.join(&result.thumbnail_filename);
        fs::write(&thumbnail_path, &result.thumbnail_data)
            .await
            .context("Failed to write thumbnail")?;
        info!("Saved thumbnail: {}", result.thumbnail_filename);

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

    /// Delete image files
    pub async fn delete_image(&self, filename: &str, thumbnail_filename: &str) -> Result<()> {
        let file_path = self.upload_path.join(filename);
        let thumbnail_path = self.upload_path.join(thumbnail_filename);

        // Delete main image
        if file_path.exists() {
            fs::remove_file(&file_path)
                .await
                .context("Failed to delete image file")?;
            info!("Deleted image: {}", filename);
        } else {
            warn!("Image file not found: {}", filename);
        }

        // Delete thumbnail
        if thumbnail_path.exists() {
            fs::remove_file(&thumbnail_path)
                .await
                .context("Failed to delete thumbnail")?;
            info!("Deleted thumbnail: {}", thumbnail_filename);
        } else {
            warn!("Thumbnail not found: {}", thumbnail_filename);
        }

        Ok(())
    }

    /// Verify upload directory exists
    pub async fn ensure_upload_dir(&self) -> Result<()> {
        fs::create_dir_all(&self.upload_path)
            .await
            .context("Failed to create upload directory")?;
        Ok(())
    }

    /// Get image path
    pub fn get_image_path(&self, filename: &str) -> PathBuf {
        self.upload_path.join(filename)
    }
}

// ── Internal helpers (pure, sync — run inside spawn_blocking) ───────────────

/// Intermediate result from the blocking thread, carries encoded bytes
/// so the async side can write them to disk.
struct ProcessedImageIntermediate {
    filename: String,
    thumbnail_filename: String,
    width: u32,
    height: u32,
    blur_hash: String,
    size: u64,
    avif_data: Vec<u8>,
    thumbnail_data: Vec<u8>,
    upload_path: PathBuf,
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

    // Use CatmullRom instead of Lanczos3 — nearly identical quality but ~30% faster
    img.resize(new_width, new_height, FilterType::CatmullRom)
}

/// Generate blur hash for placeholder image
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

// Helper trait for RGBA conversion
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

    #[tokio::test]
    async fn test_image_service_creation() {
        let service = ImageService::new(PathBuf::from("/tmp/uploads"));
        assert_eq!(service.max_width, 1920);
        assert_eq!(service.thumbnail_width, 400);
        assert_eq!(service.avif_speed, 8);
    }
}
