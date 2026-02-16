// ---------------------------------------------------------------------------
// CSRF Token Utility
//
// Reads the `paayo_csrf` cookie (set by the Rust backend's CSRF middleware)
// and provides helpers to include the token in state-changing requests.
//
// The backend uses a double-submit cookie pattern:
//   1. It sets a `paayo_csrf` cookie (non-HttpOnly, so JS can read it).
//   2. State-changing requests (POST/PUT/DELETE/PATCH) must include an
//      `X-CSRF-Token` header whose value matches the cookie.
//   3. An attacker on a different origin can cause the cookie to be sent
//      but cannot read it (same-origin policy), so they can't forge the header.
//
// Usage:
//   import { getCsrfToken, csrfHeaders, apiFetch } from "@/lib/csrf";
//
//   // Option 1: Use apiFetch (drop-in replacement for fetch)
//   const res = await apiFetch("/api/posts", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(data),
//   });
//
//   // Option 2: Manually add headers
//   fetch("/api/posts", {
//     method: "POST",
//     headers: { ...csrfHeaders(), "Content-Type": "application/json" },
//     body: JSON.stringify(data),
//   });
// ---------------------------------------------------------------------------

/**
 * Read the `paayo_csrf` cookie value from `document.cookie`.
 *
 * Returns `null` if the cookie is not present (e.g., first page load before
 * the backend has set it, or during SSR where `document` is unavailable).
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith("paayo_csrf=")) {
      const value = trimmed.slice("paayo_csrf=".length);
      return value || null;
    }
  }

  return null;
}

/**
 * Returns a headers object containing the CSRF token header.
 *
 * If the token is not available, returns an empty object (the backend
 * will reject the request with 403, which is the correct behavior —
 * the client should retry after the cookie is provisioned).
 *
 * @example
 * fetch("/api/posts", {
 *   method: "POST",
 *   headers: { ...csrfHeaders(), "Content-Type": "application/json" },
 *   body: JSON.stringify(data),
 * });
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (token) {
    return { "X-CSRF-Token": token };
  }
  return {};
}

/**
 * State-changing HTTP methods that require CSRF protection.
 */
const CSRF_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * A drop-in wrapper around `fetch()` that automatically includes the
 * CSRF token header on state-changing requests.
 *
 * - Preserves all `fetch()` options (credentials, signal, cache, etc.)
 * - Merges the CSRF header with any existing headers (Headers object,
 *   plain object, or array-of-tuples — all formats supported)
 * - Only adds the header for POST/PUT/DELETE/PATCH methods
 * - Safe methods (GET, HEAD, OPTIONS) pass through unchanged
 *
 * By default, `credentials: "include"` is set so cookies are sent.
 * You can override this by passing a different `credentials` value.
 *
 * @example
 * const res = await apiFetch("/api/media", {
 *   method: "POST",
 *   body: formData,
 * });
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();

  // Default to credentials: "include" so session cookies are sent
  const options: RequestInit = {
    credentials: "include",
    ...init,
  };

  // Only attach CSRF header on state-changing methods
  if (CSRF_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      // Merge with existing headers, supporting all header formats
      const existingHeaders = new Headers(options.headers as HeadersInit);
      existingHeaders.set("X-CSRF-Token", token);
      options.headers = existingHeaders;
    }
  }

  return fetch(input, options);
}
