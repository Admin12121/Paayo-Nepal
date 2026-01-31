import { getPlaiceholder } from "plaiceholder";

/**
 * Generate blur data URL from an image URL
 * For use with Next.js Image component placeholder="blur"
 */
export async function getBlurDataURL(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { base64 } = await getPlaiceholder(buffer);
    return base64;
  } catch (error) {
    console.error("Error generating blur placeholder:", error);
    // Return a default gray blur placeholder
    return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsLCwsNCgsMDQ4ODQ0LDA4QEBERDxANDQ0REBEPEBcRERH/2wBDAQMEBAUEBQkFBQkRDA0MEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREf/AABEIAAIAAwMBIgACEQEDEQH/xABRAAEBAAAAAAAAAAAAAAAAAAAJCgEBAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAOBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AswAB/9k=";
  }
}

/**
 * Get image dimensions from URL
 */
export async function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const { metadata } = await getPlaiceholder(buffer);
    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch {
    return null;
  }
}

/**
 * Convert blurhash to data URL
 * Use this when you have a blurhash string from the API
 */
export function blurhashToDataURL(
  blurhash: string,
  width: number = 32,
  height: number = 32
): string {
  // For SSR compatibility, we return a simple gray placeholder
  // In a client component, you could use the blurhash library to decode
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#E5E7EB"/></svg>`
  )}`;
}

/**
 * Get upload URL for images
 */
export function getUploadUrl(filename: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * Get thumbnail URL for images
 */
export function getThumbnailUrl(filename: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${baseUrl}/uploads/thumb_${filename}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Check if file is a valid image type
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return validTypes.includes(mimeType);
}

/**
 * Get aspect ratio class for image containers
 */
export function getAspectRatioClass(
  width: number | null,
  height: number | null
): string {
  if (!width || !height) return "aspect-video";
  const ratio = width / height;
  if (ratio > 1.6) return "aspect-video";
  if (ratio > 1.2) return "aspect-[4/3]";
  if (ratio > 0.8) return "aspect-square";
  return "aspect-[3/4]";
}
