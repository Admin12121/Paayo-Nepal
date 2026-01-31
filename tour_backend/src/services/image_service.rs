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
            avif_speed: 4,    // 1-10, higher = faster but lower quality
        }
    }

    /// Process uploaded image: resize, convert to AVIF, generate thumbnail and blur hash
    pub async fn process_image(
        &self,
        image_data: &[u8],
        original_filename: &str,
    ) -> Result<ProcessedImage> {
        // Load image
        let img = ImageReader::new(Cursor::new(image_data))
            .with_guessed_format()
            .context("Failed to guess image format")?
            .decode()
            .context("Failed to decode image")?;

        info!(
            "Processing image: {} ({}x{})",
            original_filename,
            img.width(),
            img.height()
        );

        // Generate unique filename
        let file_id = uuid::Uuid::new_v4().to_string();
        let filename = format!("{}.avif", file_id);
        let thumbnail_filename = format!("{}_thumb.avif", file_id);

        // Resize if needed (maintain aspect ratio)
        let resized = self.resize_image(&img, self.max_width, self.max_height);
        let (width, height) = (resized.width(), resized.height());

        // Generate blur hash (sample to 32x32 for performance)
        let blur_hash = self.generate_blur_hash(&resized)?;

        // Convert to AVIF and save main image
        let avif_data = self.encode_avif(&resized)?;
        let file_path = self.upload_path.join(&filename);
        fs::write(&file_path, &avif_data)
            .await
            .context("Failed to write AVIF file")?;

        info!("Saved main image: {}", filename);

        // Generate and save thumbnail
        let thumbnail = self.resize_image(&img, self.thumbnail_width, self.thumbnail_height);
        let thumbnail_data = self.encode_avif(&thumbnail)?;
        let thumbnail_path = self.upload_path.join(&thumbnail_filename);
        fs::write(&thumbnail_path, &thumbnail_data)
            .await
            .context("Failed to write thumbnail")?;

        info!("Saved thumbnail: {}", thumbnail_filename);

        // Get file size
        let size = avif_data.len() as u64;

        Ok(ProcessedImage {
            filename,
            thumbnail_filename,
            width,
            height,
            blur_hash,
            size,
            mime_type: "image/avif".to_string(),
        })
    }

    /// Resize image maintaining aspect ratio
    fn resize_image(&self, img: &DynamicImage, max_width: u32, max_height: u32) -> DynamicImage {
        let (width, height) = img.dimensions();

        // If image is within limits, return original
        if width <= max_width && height <= max_height {
            return img.clone();
        }

        // Calculate new dimensions maintaining aspect ratio
        let width_ratio = max_width as f32 / width as f32;
        let height_ratio = max_height as f32 / height as f32;
        let ratio = width_ratio.min(height_ratio);

        let new_width = (width as f32 * ratio) as u32;
        let new_height = (height as f32 * ratio) as u32;

        info!(
            "Resizing image from {}x{} to {}x{}",
            width, height, new_width, new_height
        );

        img.resize(new_width, new_height, FilterType::Lanczos3)
    }

    /// Generate blur hash for placeholder
    fn generate_blur_hash(&self, img: &DynamicImage) -> Result<String> {
        // Resize to 32x32 for blur hash calculation (performance)
        let small = img.resize_exact(32, 32, FilterType::Triangle);
        let rgba = small.to_rgba8();
        let (width, height) = small.dimensions();

        // Generate blur hash (4x3 components = good balance)
        let hash = encode(4, 3, width, height, &rgba.into_raw())
            .context("Failed to generate blur hash")?;

        Ok(hash)
    }

    /// Encode image as AVIF
    fn encode_avif(&self, img: &DynamicImage) -> Result<Vec<u8>> {
        let rgba = img.to_rgba8();
        let (width, height) = img.dimensions();

        // Configure AVIF encoder
        let encoder = ravif::Encoder::new()
            .with_quality(self.avif_quality as f32)
            .with_speed(self.avif_speed)
            .with_alpha_quality(self.avif_quality as f32);

        // Create image buffer for ravif
        let rgba_pixels: Vec<ravif::RGBA8> = rgba.as_raw().as_rgba();
        let img_data = ravif::Img::new(rgba_pixels.as_slice(), width as usize, height as usize);

        // Encode
        let encoded = encoder
            .encode_rgba(img_data)
            .map_err(|e| anyhow::anyhow!("AVIF encoding failed: {}", e))?;

        Ok(encoded.avif_file)
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
    }
}
