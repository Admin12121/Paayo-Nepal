import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getDeviceId } from "@/lib/device-id";
import { getCsrfToken } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// RTK Query — Base API
//
// Central API slice that all feature-specific endpoints are injected into.
//
// Architecture:
//   - Client-side requests go to `/api` which nginx routes directly to Rust.
//   - `credentials: "include"` ensures the `paayo_session` HttpOnly cookie
//     is sent with every request, so Rust can authenticate the user.
//   - The `X-Device-Id` header is attached for per-device rate limiting
//     (solves the shared-office / NAT problem).
//   - Server-side (SSR) data fetching still uses `lib/api-client.ts` with
//     Next.js fetch caching — RTK Query is client-side only.
//
// Tag-based cache invalidation:
//   Mutations automatically invalidate relevant tags so list queries
//   refetch with fresh data. Tags follow the pattern:
//     - `{ type: 'Post', id: 'LIST' }`   → invalidates all post lists
//     - `{ type: 'Post', id: '<slug>' }` → invalidates a specific post
// ---------------------------------------------------------------------------

const tagTypes = [
  "Post",
  "Event",
  "Attraction",
  "Activity",
  "Region",
  "Hotel",
  "Video",
  "Photo",
  "HeroSlide",
  "Tag",
  "Comment",
  "Media",
  "Notification",
  "DashboardStats",
  "Search",
  "ViewStats",
  "LikeStatus",
  "User",
  "ContentLink",
] as const;

export const baseApi = createApi({
  reducerPath: "api",

  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    credentials: "include",
    cache: "no-store",

    prepareHeaders: (headers, { type }) => {
      // Always set JSON content type unless it's a multipart upload
      // (multipart requests should NOT set content-type — the browser
      // sets it automatically with the correct boundary).
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      // Attach persistent device fingerprint for per-device rate limiting.
      // Only runs client-side (getDeviceId returns null during SSR).
      try {
        const deviceId = getDeviceId();
        if (deviceId) {
          headers.set("X-Device-Id", deviceId);
        }
      } catch {
        // device-id module unavailable — backend falls back to IP+UA hash
      }

      // CSRF protection — double-submit cookie pattern.
      // Attach the `X-CSRF-Token` header on mutations (POST/PUT/DELETE/PATCH).
      // The value must match the `paayo_csrf` cookie that the Rust backend sets.
      // RTK Query marks mutations as type "mutation" vs queries as type "query".
      if (type === "mutation") {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers.set("X-CSRF-Token", csrfToken);
        }
      }

      return headers;
    },
  }),

  tagTypes: [...tagTypes],

  // No endpoints defined here — they are injected by feature slices via
  // `baseApi.injectEndpoints()`. This keeps the base slim and allows
  // code-splitting per feature.
  endpoints: () => ({}),

  // Keep unused data in cache for 5 minutes before garbage-collecting.
  // Individual endpoints can override this with `keepUnusedDataFor`.
  keepUnusedDataFor: 0,

  // Always refetch on mount/arg change to avoid stale admin/editor tables.
  refetchOnMountOrArgChange: true,

  // Refetch data when the browser tab regains focus (stale-while-revalidate
  // pattern). This keeps dashboard data fresh without manual refresh.
  refetchOnFocus: true,

  // Refetch when the network reconnects (e.g., laptop wakes from sleep).
  refetchOnReconnect: true,
});

// ---------------------------------------------------------------------------
// Helper: build a query string from a params object.
//
// Filters out undefined/null values and converts booleans/numbers to strings.
// Used by endpoint query functions to build URL search params consistently.
//
// Example:
//   buildQueryString({ page: 1, limit: 20, status: undefined })
//   → "?page=1&limit=20"
// ---------------------------------------------------------------------------
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Helper: standard list-tag provider for paginated endpoints.
//
// Given a paginated response with `data: T[]`, produces:
//   - One tag per item:  { type, id: item.id }     (or item.slug)
//   - One list tag:      { type, id: 'LIST' }
//
// This means:
//   - Mutating a specific item invalidates its individual tag
//   - Creating/deleting items invalidates the 'LIST' tag → refetches lists
// ---------------------------------------------------------------------------
export function provideListTags<
  T extends { id: string; slug?: string },
  TagType extends (typeof tagTypes)[number],
>(tagType: TagType) {
  return (result: { data: T[] } | undefined) => {
    if (!result?.data) {
      return [{ type: tagType, id: "LIST" as const }];
    }

    return [
      { type: tagType, id: "LIST" as const },
      ...result.data.map((item) => ({
        type: tagType,
        id: item.slug || item.id,
      })),
    ];
  };
}
