/**
 * Device fingerprint utility for per-device rate limiting.
 *
 * Generates a persistent UUID stored in localStorage. Sent as the
 * `X-Device-Id` header on API requests so the backend can rate-limit
 * per device instead of per IP — solving the shared-office / NAT problem
 * where multiple users share one public IP.
 *
 * Fallback: if localStorage is unavailable (SSR, private browsing edge
 * cases, or storage quota exceeded) returns `null` and the backend falls
 * back to its own IP + User-Agent hash for rate limiting.
 */

const STORAGE_KEY = "paayo_device_id";

/**
 * Generate a v4-style UUID without requiring a dependency.
 * Uses crypto.randomUUID() when available, otherwise falls back to
 * crypto.getRandomValues().
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback for older browsers that have getRandomValues but not randomUUID
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (RFC 4122) bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  // Last resort: Math.random-based (not cryptographically secure, but
  // good enough for a rate-limit key — not used for security purposes)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate that a string looks like a UUID (8-4-4-4-12 hex pattern).
 */
function isValidDeviceId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Get or create a persistent device ID.
 *
 * - Returns the existing ID from localStorage if valid.
 * - Generates and persists a new one if missing or corrupted.
 * - Returns `null` on the server or if localStorage is unavailable.
 */
export function getDeviceId(): string | null {
  // Server-side: no device fingerprint
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = localStorage.getItem(STORAGE_KEY);

    if (existing && isValidDeviceId(existing)) {
      return existing;
    }

    // Generate new ID
    const id = generateUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, etc.)
    // Backend will fall back to IP + User-Agent hash
    return null;
  }
}

/**
 * Reset the device ID (generates a new one on next call to getDeviceId).
 * Useful if the user wants to clear their fingerprint.
 */
export function resetDeviceId(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — localStorage unavailable
  }
}
