import { getCsrfToken } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Shared API client
//
// Used by:
//   - Server components/actions (direct Rust URL via BACKEND_API_URL)
//   - Client components (same-origin /api through nginx)
//
// This runtime split avoids browser-side "Failed to fetch" errors caused by
// server-only hostnames like http://backend:8080.
// ---------------------------------------------------------------------------
const SERVER_API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.INTERNAL_API_URL ||
  "http://backend:8080/api";
const CLIENT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const CSRF_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  tags?: string[];
  revalidate?: number | false;
  cache?: RequestCache;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getRuntimeBaseUrl(): string {
    if (typeof window !== "undefined") {
      return CLIENT_API_BASE_URL;
    }

    return this.baseUrl;
  }

  private buildRequestUrl(endpoint: string): string {
    const base = this.getRuntimeBaseUrl().replace(/\/+$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Server-side only: extract the raw session token from BetterAuth's
    // signed cookie and forward it to the Rust backend. This is used by
    // Next.js server components for authenticated SSR data fetching.
    //
    // Client-side data fetching uses RTK Query (lib/store/api/) which
    // sends the `paayo_session` cookie automatically via
    // `credentials: "include"`.
    //
    // The typeof window check prevents the bundler from tracing server-only
    // imports (pg, redis, bcryptjs) into the client bundle.
    if (typeof window === "undefined") {
      try {
        const { headers: getHeaders } = await import("next/headers");
        const { auth } = await import("@/lib/auth-server");
        const reqHeaders = await getHeaders();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (session?.session?.token) {
          // Send both cookie names so Rust finds whichever it checks first
          headers["Cookie"] =
            `paayo_session=${session.session.token}; better-auth.session_token=${session.session.token}`;
        }
      } catch {
        // Session not available or headers() not in request context
      }
    }

    return headers;
  }

  private async getClientCsrfToken(
    forceRefresh = false,
  ): Promise<string | null> {
    if (typeof window === "undefined") return null;

    let token = getCsrfToken();
    if (token && !forceRefresh) return token;

    // Warm up CSRF cookie on first mutation-heavy pages that haven't
    // made any prior backend GET request yet.
    let responseToken: string | null = null;
    try {
      const response = await fetch("/api/health", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      responseToken = response.headers.get("x-csrf-token");
    } catch {
      // Ignore preflight failures — request may still succeed if backend
      // doesn't enforce CSRF for this endpoint.
    }

    token = getCsrfToken();
    return token || responseToken;
  }

  private async parseResponseBody<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return undefined as T;
    }

    const raw = await response.text();
    if (!raw) {
      return undefined as T;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  private async parseErrorBody(response: Response): Promise<{
    message?: string;
    details?: unknown;
  }> {
    const raw = await response.text();
    if (!raw) return {};

    try {
      return JSON.parse(raw) as { message?: string; details?: unknown };
    } catch {
      return {};
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, tags, revalidate, cache } = options;
    const upperMethod = method.toUpperCase();
    const url = this.buildRequestUrl(endpoint);
    const headers = new Headers(await this.getHeaders());

    if (typeof window !== "undefined" && CSRF_METHODS.has(upperMethod)) {
      const csrfToken = await this.getClientCsrfToken();
      if (csrfToken) {
        headers.set("X-CSRF-Token", csrfToken);
      }
    }

    const fetchOptions: RequestInit & {
      next?: { tags?: string[]; revalidate?: number | false };
    } = {
      method: upperMethod,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    };

    if (typeof window === "undefined") {
      fetchOptions.next = { tags, revalidate };
    }

    if (cache) {
      fetchOptions.cache = cache;
    }

    try {
      let response = await fetch(url, fetchOptions);

      // If CSRF token/cookie state is stale, refresh token and retry once.
      if (
        !response.ok &&
        response.status === 403 &&
        typeof window !== "undefined" &&
        CSRF_METHODS.has(upperMethod)
      ) {
        const freshCsrfToken = await this.getClientCsrfToken(true);
        if (freshCsrfToken) {
          headers.set("X-CSRF-Token", freshCsrfToken);
          response = await fetch(url, fetchOptions);
        }
      }

      if (!response.ok) {
        const error = await this.parseErrorBody(response);
        throw new ApiError(
          response.status,
          error.message || `API Error: ${response.statusText}`,
          error.details,
        );
      }

      return this.parseResponseBody<T>(response);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }

      if (err instanceof TypeError) {
        throw new ApiError(
          0,
          `Network error while requesting ${url}`,
          err.message,
        );
      }

      throw err;
    }
  }

  // Convenience methods
  get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(
    endpoint: string,
    body: unknown,
    options?: Omit<RequestOptions, "method">,
  ) {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  put<T>(
    endpoint: string,
    body: unknown,
    options?: Omit<RequestOptions, "method">,
  ) {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  delete<T>(
    endpoint: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient(SERVER_API_BASE_URL);

// Pagination response type
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// Helper: enrich a post-like object returned by the backend.
//
// The backend stores type-specific metadata inside the JSONB `content` column.
// Pages, however, reference those attributes as top-level fields (e.g.
// `attraction.rating`, `event.location`, `activity.icon`). This function
// flattens the JSONB content into the object and maps aliased field names so
// that existing page code continues to work without modification.
// ---------------------------------------------------------------------------
function enrichPost<T extends PostRaw>(raw: T): T & PostEnriched {
  // `content` from the backend is either a JSON object or null.
  // If it's an object we spread its properties onto the result so that
  // nested keys like `rating`, `address`, `icon`, `location`, etc. become
  // top-level fields.
  const contentObj: Record<string, unknown> =
    raw.content !== null &&
    typeof raw.content === "object" &&
    !Array.isArray(raw.content)
      ? (raw.content as Record<string, unknown>)
      : {};

  return {
    // Spread content first so explicit column values always win
    ...contentObj,
    ...raw,
    // Alias: backend serialises `type` (from `post_type` with serde rename)
    post_type: raw.type,
    // Alias: `views` / `likes` are the names pages use
    views: raw.view_count ?? 0,
    likes: raw.like_count ?? 0,
    // Map: pages use `description` which maps to `short_description`
    description:
      raw.short_description ??
      (contentObj.description as string | null) ??
      null,
    // Event-specific aliases
    start_time:
      (contentObj.start_time as string | null) ?? raw.event_date ?? null,
    end_time:
      (contentObj.end_time as string | null) ?? raw.event_end_date ?? null,
    location: (contentObj.location as string | null) ?? null,
    // Attraction-specific (may come from content JSONB)
    rating: (contentObj.rating as number | null) ?? null,
    review_count: (contentObj.review_count as number) ?? 0,
    address: (contentObj.address as string | null) ?? null,
    entry_fee: (contentObj.entry_fee as string | null) ?? null,
    latitude: (contentObj.latitude as number | null) ?? null,
    longitude: (contentObj.longitude as number | null) ?? null,
    opening_hours: (contentObj.opening_hours as OpeningHours | null) ?? null,
    // Activity-specific
    icon: (contentObj.icon as string | null) ?? null,
    is_active: raw.status === "published",
    // Tags / SEO (may live in content JSONB)
    tags: (contentObj.tags as string[]) ?? [],
    meta_title: (contentObj.meta_title as string | null) ?? null,
    meta_description: (contentObj.meta_description as string | null) ?? null,
  } as T & PostEnriched;
}

/** Enrich a paginated response of post-like items. */
function enrichPaginated<T extends PostRaw>(
  resp: PaginatedResponse<T>,
): PaginatedResponse<T & PostEnriched> {
  return {
    ...resp,
    data: resp.data.map(enrichPost),
  };
}

// ---------------------------------------------------------------------------
// Opening hours structure used by attractions
// ---------------------------------------------------------------------------
export interface OpeningHours {
  [day: string]: string | { open: string; close: string } | null;
}

// ---------------------------------------------------------------------------
// Raw post type — exactly what the backend returns
// ---------------------------------------------------------------------------
export interface PostRaw {
  id: string;
  type: string;
  author_id: string;
  region_id: string | null;
  title: string;
  slug: string;
  short_description: string | null;
  content: unknown | null;
  cover_image: string | null;
  status: string;
  published_at: string | null;
  event_date: string | null;
  event_end_date: string | null;
  display_order: number | null;
  is_featured: boolean;
  like_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Extra fields produced by the enrichment layer
// ---------------------------------------------------------------------------
export interface PostEnriched {
  /** Alias of `type` */
  post_type: string;
  /** Alias of `view_count` */
  views: number;
  /** Alias of `like_count` */
  likes: number;
  /** Maps to `short_description` or content.description */
  description: string | null;
  /** Tags (from content JSONB) */
  tags: string[];
  /** SEO title (from content JSONB) */
  meta_title: string | null;
  /** SEO description (from content JSONB) */
  meta_description: string | null;

  // Event-specific
  start_time: string | null;
  end_time: string | null;
  location: string | null;

  // Attraction-specific
  rating: number | null;
  review_count: number;
  address: string | null;
  entry_fee: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: OpeningHours | null;

  // Activity-specific
  icon: string | null;
  is_active: boolean;
}

// ============= Posts API =============
export type Post = PostRaw & PostEnriched;

export interface CreatePostInput {
  title: string;
  short_description?: string;
  content?: unknown;
  cover_image?: string;
  post_type?: string;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
}

export const postsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    sort_by?: string;
    is_featured?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.type) searchParams.set("post_type", params.type);
    if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params?.is_featured !== undefined)
      searchParams.set("is_featured", String(params.is_featured));
    return api
      .get<PaginatedResponse<PostRaw>>(`/posts?${searchParams}`, {
        tags: ["posts"],
        revalidate: 60,
      })
      .then(enrichPaginated);
  },

  getBySlug: (slug: string) =>
    api
      .get<PostRaw>(`/posts/${slug}`, {
        tags: [`post-${slug}`],
        revalidate: 60,
      })
      .then(enrichPost),

  create: (data: CreatePostInput) =>
    api.post<PostRaw>("/posts", data).then(enrichPost),

  update: (slug: string, data: Partial<CreatePostInput>) =>
    api.put<PostRaw>(`/posts/${slug}`, data).then(enrichPost),

  delete: (slug: string) => api.delete(`/posts/${slug}`),

  publish: (id: string) =>
    api.post<PostRaw>(`/posts/${id}/publish`, {}).then(enrichPost),

  approve: (id: string) =>
    api.post<PostRaw>(`/posts/${id}/approve`, {}).then(enrichPost),

  updateFeatured: (id: string, is_featured: boolean) =>
    api.put<PostRaw>(`/posts/${id}/featured`, { is_featured }).then(enrichPost),

  updateDisplayOrder: (id: string, display_order: number | null) =>
    api
      .put<PostRaw>(`/posts/${id}/display-order`, { display_order })
      .then(enrichPost),
};

// ============= Media API =============
export interface Media {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  media_type: string;
  width: number | null;
  height: number | null;
  blur_hash: string | null;
  thumbnail_path: string | null;
  alt: string | null;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
  /** Computed by backend — ready-to-use URL, e.g. `/uploads/uuid.avif` */
  url: string;
  /** Computed by backend — thumbnail URL, e.g. `/uploads/uuid_thumb.avif` */
  thumbnail_url: string | null;
}

export const mediaApi = {
  list: (params?: { page?: number; limit?: number; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.type) searchParams.set("media_type", params.type);
    return api.get<PaginatedResponse<Media>>(`/media?${searchParams}`);
  },

  gallery: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<PaginatedResponse<Media>>(`/media/gallery?${searchParams}`, {
      tags: ["gallery"],
      revalidate: 300,
    });
  },

  get: (id: string) => api.get<Media>(`/media/${id}`),

  delete: (id: string) => api.delete(`/media/${id}`),
};

// ============= Events API =============
// Events are stored in the posts table with type='event'.
// The enrichment layer maps event_date → start_time, event_end_date → end_time,
// and flattens content JSONB fields like `location`.
export type Event = Post;

export const eventsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    region_id?: string;
    featured?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.region_id) searchParams.set("region_id", params.region_id);
    if (params?.featured !== undefined)
      searchParams.set("featured", String(params.featured));
    return api
      .get<PaginatedResponse<PostRaw>>(`/events?${searchParams}`, {
        tags: ["events"],
        revalidate: 300,
      })
      .then(enrichPaginated);
  },

  upcoming: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api
      .get<PaginatedResponse<PostRaw>>(`/events/upcoming?${searchParams}`, {
        tags: ["events-upcoming"],
        revalidate: 300,
      })
      .then(enrichPaginated);
  },

  getBySlug: (slug: string) =>
    api
      .get<PostRaw>(`/events/${slug}`, {
        tags: [`event-${slug}`],
        revalidate: 300,
      })
      .then(enrichPost),
};

// ============= Regions API =============
export interface Region {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  map_data: unknown | null;
  attraction_rank: number | null;
  is_featured: boolean;
  status: string;
  author_id: string;
  province: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const regionsApi = {
  list: (params?: { page?: number; limit?: number; province?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.province) searchParams.set("province", params.province);
    return api.get<PaginatedResponse<Region>>(`/regions?${searchParams}`, {
      tags: ["regions"],
      revalidate: 3600,
    });
  },

  getBySlug: (slug: string) =>
    api.get<Region>(`/regions/${slug}`, {
      tags: [`region-${slug}`],
      revalidate: 3600,
    }),

  getAttractions: (
    slug: string,
    params?: { page?: number; limit?: number },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api
      .get<
        PaginatedResponse<PostRaw>
      >(`/regions/${slug}/attractions?${searchParams}`)
      .then(enrichPaginated) as Promise<PaginatedResponse<Attraction>>;
  },
};

// ============= Attractions API =============
// Attractions are stored in posts table with type='explore'.
// The enrichment layer flattens content JSONB fields like `rating`, `address`,
// `entry_fee`, `opening_hours`, `latitude`, `longitude`, etc.
export type Attraction = Post;

export const attractionsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    region_id?: string;
    is_featured?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.region_id) searchParams.set("region_id", params.region_id);
    if (params?.is_featured !== undefined)
      searchParams.set("is_featured", String(params.is_featured));
    return api
      .get<PaginatedResponse<PostRaw>>(`/attractions?${searchParams}`, {
        tags: ["attractions"],
        revalidate: 300,
      })
      .then(enrichPaginated);
  },

  top: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api
      .get<PaginatedResponse<PostRaw>>(`/attractions/top?${searchParams}`, {
        tags: ["attractions-top"],
        revalidate: 300,
      })
      .then(enrichPaginated);
  },

  getBySlug: (slug: string) =>
    api
      .get<PostRaw>(`/attractions/${slug}`, {
        tags: [`attraction-${slug}`],
        revalidate: 300,
      })
      .then(enrichPost),
};

// ============= Activities API =============
// Activities are stored in posts table with type='activity'.
// The enrichment layer flattens content JSONB fields like `icon`.
export type Activity = Post;

export const activitiesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    is_featured?: boolean;
    is_active?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.is_featured !== undefined)
      searchParams.set("is_featured", String(params.is_featured));
    if (params?.is_active !== undefined)
      searchParams.set("status", params.is_active ? "published" : "draft");
    return api
      .get<PaginatedResponse<PostRaw>>(`/activities?${searchParams}`, {
        tags: ["activities"],
        revalidate: 3600,
      })
      .then(enrichPaginated);
  },

  getBySlug: (slug: string) =>
    api
      .get<PostRaw>(`/activities/${slug}`, {
        tags: [`activity-${slug}`],
        revalidate: 3600,
      })
      .then(enrichPost),
};

// ============= Search API =============
export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  result_type: string;
  url: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

export const searchApi = {
  search: (query: string, params?: { limit?: number; type?: string }) => {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.type) searchParams.set("type", params.type);
    return api.get<SearchResponse>(`/search?${searchParams}`);
  },
};

// ============= Comments API =============
export interface Comment {
  id: string;
  parent_id: string | null;
  target_type: string;
  target_id: string;
  guest_name: string;
  guest_email: string;
  content: string;
  status: string;
  ip_address: string | null;
  viewer_hash: string | null;
  created_at: string;
  updated_at: string;
}

export const commentsApi = {
  listForPost: (postId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<PaginatedResponse<Comment>>(
      `/comments/post/${postId}?${searchParams}`,
    );
  },

  listForContent: (params: {
    target_type: string;
    target_id: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set("target_type", params.target_type);
    searchParams.set("target_id", params.target_id);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    return api.get<PaginatedResponse<Comment>>(`/comments?${searchParams}`);
  },

  create: (data: {
    target_type: string;
    target_id: string;
    guest_name: string;
    guest_email: string;
    content: string;
    parent_id?: string;
  }) => api.post<Comment>(`/comments`, data),

  update: (id: string, content: string) =>
    api.put<Comment>(`/comments/${id}`, { content }),

  delete: (id: string) => api.delete(`/comments/${id}`),

  // Admin moderation
  listForModeration: (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    return api.get<PaginatedResponse<Comment>>(
      `/comments/moderation?${searchParams}`,
    );
  },

  pendingCount: () =>
    api.get<{ count: number }>("/comments/moderation/pending-count"),

  approve: (id: string) => api.post<Comment>(`/comments/${id}/approve`, {}),

  reject: (id: string) => api.post<Comment>(`/comments/${id}/reject`, {}),

  markSpam: (id: string) => api.post<Comment>(`/comments/${id}/spam`, {}),

  batchApprove: (ids: string[]) =>
    api.post<{ approved: number }>("/comments/batch/approve", { ids }),

  batchDelete: (ids: string[]) =>
    api.post<{ deleted: number }>("/comments/batch/delete", { ids }),
};

// ============= Notifications API =============
export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  message: string | null;
  target_type: string | null;
  target_id: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: (params?: { limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<Notification[]>(`/notifications?${searchParams}`);
  },

  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    api.post<{ success: boolean }>(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    api.post<{ success: boolean }>("/notifications/read-all", {}),

  /**
   * Connect to the SSE stream for real-time notifications.
   *
   * Events emitted:
   * - `connected`     — `{ user_id: string }`
   * - `notification`  — a new `Notification` object
   * - `unread_count`  — `{ count: number }`
   * - `heartbeat`     — `"ping"`
   *
   * @returns an `EventSource` instance the caller should close on unmount.
   */
  stream: (): EventSource =>
    new EventSource("/api/notifications/stream", { withCredentials: true }),
};

// ============= Hotels API =============
export interface Hotel {
  id: string;
  author_id: string;
  region_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  star_rating: number | null;
  price_range: string | null;
  amenities: unknown | null;
  cover_image: string | null;
  gallery: unknown | null;
  status: string;
  published_at: string | null;
  display_order: number | null;
  is_featured: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HotelBranch {
  id: string;
  hotel_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  coordinates: unknown | null;
  is_main: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHotelInput {
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  star_rating?: number;
  price_range?: string;
  amenities?: unknown;
  cover_image?: string;
  gallery?: unknown;
  region_id?: string;
  is_featured?: boolean;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  coordinates?: unknown;
  is_main?: boolean;
}

export const hotelsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    region_id?: string;
    price_range?: string;
    is_featured?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.region_id) searchParams.set("region_id", params.region_id);
    if (params?.price_range)
      searchParams.set("price_range", params.price_range);
    if (params?.is_featured !== undefined)
      searchParams.set("is_featured", String(params.is_featured));
    return api.get<PaginatedResponse<Hotel>>(`/hotels?${searchParams}`, {
      tags: ["hotels"],
      revalidate: 300,
    });
  },

  getBySlug: (slug: string) =>
    api.get<Hotel>(`/hotels/by-slug/${slug}`, {
      tags: [`hotel-${slug}`],
      revalidate: 300,
    }),

  getById: (id: string) => api.get<Hotel>(`/hotels/${id}`),

  create: (data: CreateHotelInput) => api.post<Hotel>("/hotels", data),

  update: (id: string, data: Partial<CreateHotelInput> & { status?: string }) =>
    api.put<Hotel>(`/hotels/${id}`, data),

  delete: (id: string) => api.delete(`/hotels/${id}`),

  publish: (id: string) =>
    api.put<Hotel>(`/hotels/${id}/status`, { status: "published" }),

  updateDisplayOrder: (id: string, display_order: number | null) =>
    api.put<Hotel>(`/hotels/${id}/display-order`, { display_order }),

  restore: (id: string) => api.post<Hotel>(`/hotels/${id}/restore`, {}),

  getBranches: (hotelId: string) =>
    api.get<HotelBranch[]>(`/hotels/${hotelId}/branches`),

  addBranch: (hotelId: string, data: CreateBranchInput) =>
    api.post<HotelBranch>(`/hotels/${hotelId}/branches`, data),

  updateBranch: (
    hotelId: string,
    branchId: string,
    data: Partial<CreateBranchInput>,
  ) => api.put<HotelBranch>(`/hotels/${hotelId}/branches/${branchId}`, data),

  removeBranch: (hotelId: string, branchId: string) =>
    api.delete(`/hotels/${hotelId}/branches/${branchId}`),
};

// ============= Videos API =============
export interface Video {
  id: string;
  author_id: string;
  region_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  platform: string;
  video_url: string;
  video_id: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  status: string;
  published_at: string | null;
  display_order: number | null;
  is_featured: boolean;
  like_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateVideoInput {
  title: string;
  description?: string;
  platform?: string;
  video_url: string;
  video_id?: string;
  thumbnail_url?: string;
  duration?: number;
  region_id?: string;
  is_featured?: boolean;
}

export const videosApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    region_id?: string;
    is_featured?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.region_id) searchParams.set("region_id", params.region_id);
    if (params?.is_featured !== undefined)
      searchParams.set("is_featured", String(params.is_featured));
    return api.get<PaginatedResponse<Video>>(`/videos?${searchParams}`, {
      tags: ["videos"],
      revalidate: 300,
    });
  },

  getBySlug: (slug: string) =>
    api.get<Video>(`/videos/by-slug/${slug}`, {
      tags: [`video-${slug}`],
      revalidate: 300,
    }),

  getById: (id: string) => api.get<Video>(`/videos/${id}`),

  create: (data: CreateVideoInput) => api.post<Video>("/videos", data),

  update: (id: string, data: Partial<CreateVideoInput> & { status?: string }) =>
    api.put<Video>(`/videos/${id}`, data),

  delete: (id: string) => api.delete(`/videos/${id}`),

  publish: (id: string) =>
    api.put<Video>(`/videos/${id}/status`, { status: "published" }),

  updateDisplayOrder: (id: string, display_order: number | null) =>
    api.put<Video>(`/videos/${id}/display-order`, { display_order }),

  restore: (id: string) => api.post<Video>(`/videos/${id}/restore`, {}),
};

// ============= Photo Features API =============
export interface PhotoImage {
  id: string;
  photo_feature_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

export interface PhotoFeature {
  id: string;
  author_id: string;
  region_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  published_at: string | null;
  display_order: number | null;
  is_featured: boolean;
  like_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  images?: PhotoImage[];
}

export interface CreatePhotoFeatureInput {
  title: string;
  description?: string;
  region_id?: string;
  is_featured?: boolean;
}

export const photoFeaturesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    is_featured?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.is_featured !== undefined)
      searchParams.set("is_featured", String(params.is_featured));
    return api.get<PaginatedResponse<PhotoFeature>>(`/photos?${searchParams}`, {
      tags: ["photos"],
      revalidate: 300,
    });
  },

  getBySlug: (slug: string) =>
    api.get<PhotoFeature>(`/photos/by-slug/${slug}`, {
      tags: [`photo-${slug}`],
      revalidate: 300,
    }),

  getById: (id: string) => api.get<PhotoFeature>(`/photos/${id}`),

  create: (data: CreatePhotoFeatureInput) =>
    api.post<PhotoFeature>("/photos", data),

  update: (
    id: string,
    data: Partial<CreatePhotoFeatureInput> & { status?: string },
  ) => api.put<PhotoFeature>(`/photos/${id}`, data),

  delete: (id: string) => api.delete(`/photos/${id}`),

  publish: (id: string) =>
    api.put<PhotoFeature>(`/photos/${id}/status`, { status: "published" }),

  updateDisplayOrder: (id: string, display_order: number | null) =>
    api.put<PhotoFeature>(`/photos/${id}/display-order`, { display_order }),

  restore: (id: string) => api.post<PhotoFeature>(`/photos/${id}/restore`, {}),

  // Image management within a photo feature
  listImages: (photoId: string) =>
    api.get<PhotoImage[]>(`/photos/${photoId}/images`),

  addImage: (
    photoId: string,
    data: { image_url: string; caption?: string; display_order?: number },
  ) => api.post<PhotoImage>(`/photos/${photoId}/images`, data),

  updateImage: (
    photoId: string,
    imageId: string,
    data: { caption?: string; display_order?: number },
  ) => api.put<PhotoImage>(`/photos/${photoId}/images/${imageId}`, data),

  removeImage: (photoId: string, imageId: string) =>
    api.delete(`/photos/${photoId}/images/${imageId}`),

  reorderImages: (
    photoId: string,
    orders: { id: string; display_order: number }[],
  ) => api.put(`/photos/${photoId}/images/reorder`, { orders }),
};

// ============= Hero Slides API =============
export interface HeroSlide {
  id: string;
  content_type: string;
  content_id: string | null;
  custom_title: string | null;
  custom_subtitle: string | null;
  custom_image: string | null;
  custom_link: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResolvedHeroSlide extends HeroSlide {
  title: string;
  subtitle: string | null;
  image: string | null;
  link: string | null;
}

export interface CreateHeroSlideInput {
  content_type: string;
  content_id?: string;
  custom_title?: string;
  custom_description?: string;
  custom_image?: string;
  custom_link?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const heroSlidesApi = {
  /** Public: get resolved hero slides for the homepage. */
  list: () =>
    api.get<ResolvedHeroSlide[]>("/hero-slides", {
      tags: ["hero-slides"],
      revalidate: 300,
    }),

  // Admin
  listAll: () => api.get<HeroSlide[]>("/hero-slides/admin"),

  counts: () =>
    api.get<{ total: number; active: number; inactive: number }>(
      "/hero-slides/admin/counts",
    ),

  getById: (id: string) => api.get<HeroSlide>(`/hero-slides/${id}`),

  create: (data: CreateHeroSlideInput) =>
    api.post<HeroSlide>("/hero-slides", data),

  update: (id: string, data: Partial<CreateHeroSlideInput>) =>
    api.put<HeroSlide>(`/hero-slides/${id}`, data),

  delete: (id: string) => api.delete(`/hero-slides/${id}`),

  toggleActive: (id: string) =>
    api.post<HeroSlide>(`/hero-slides/${id}/toggle`, {}),

  reorder: (orders: { id: string; sort_order: number }[]) =>
    api.put("/hero-slides/admin/reorder", { orders }),
};

// ============= Tags API =============
export interface Tag {
  id: string;
  name: string;
  slug: string;
  tag_type: string;
  created_at: string;
}

export interface TagWithCount extends Tag {
  content_count: number;
}

export interface CreateTagInput {
  name: string;
  tag_type?: string;
}

export const tagsApi = {
  list: (params?: { page?: number; limit?: number; tag_type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.tag_type) searchParams.set("tag_type", params.tag_type);
    return api.get<PaginatedResponse<TagWithCount>>(`/tags?${searchParams}`, {
      tags: ["tags"],
      revalidate: 600,
    });
  },

  search: (query: string) =>
    api.get<Tag[]>(`/tags/search?q=${encodeURIComponent(query)}`),

  getBySlug: (slug: string) =>
    api.get<TagWithCount>(`/tags/${slug}`, {
      tags: [`tag-${slug}`],
      revalidate: 600,
    }),

  getById: (id: string) => api.get<TagWithCount>(`/tags/${id}`),

  create: (data: CreateTagInput) => api.post<Tag>("/tags", data),

  update: (id: string, data: Partial<CreateTagInput>) =>
    api.put<Tag>(`/tags/${id}`, data),

  delete: (id: string) => api.delete(`/tags/${id}`),

  count: () => api.get<{ count: number }>("/tags/count"),
};

// ============= Views API =============
export interface ViewStats {
  target_type: string;
  target_id: string;
  total_views: number;
  unique_viewers: number;
}

export const viewsApi = {
  record: (targetType: string, targetId: string) =>
    api.post<{ success: boolean }>("/views", {
      target_type: targetType,
      target_id: targetId,
    }),

  getStats: (targetType: string, targetId: string) =>
    api.get<ViewStats>(`/views/${targetType}/${targetId}`),
};

// ============= Likes API =============
export interface LikeStatus {
  liked: boolean;
  like_count: number;
}

export const likesApi = {
  toggle: (targetType: string, targetId: string) =>
    api.post<LikeStatus>(`/content/${targetType}/${targetId}/like`, {}),

  status: (targetType: string, targetId: string) =>
    api.get<LikeStatus>(`/content/${targetType}/${targetId}/like-status`),
};

// ============= Admin Stats API =============
// Aggregation helpers for the admin dashboard. These call existing endpoints
// and combine the results into a single dashboard-friendly shape.

export interface ViewSummaryItem {
  target_type: string;
  total_views: number;
  unique_viewers: number;
}

export interface UserCounts {
  total: number;
  active: number;
  pending: number;
  blocked: number;
  admins: number;
  editors: number;
}

export interface DashboardStats {
  posts: { total: number; published: number; draft: number; pending: number };
  media: { total: number };
  events: { total: number; upcoming: number };
  attractions: { total: number };
  regions: { total: number };
  users: UserCounts;
  views: ViewSummaryItem[];
  totalViews: number;
  totalLikes: number;
  comments: { pending: number };
  videos: { total: number };
  hotels: { total: number };
  photos: { total: number };
}

export const adminStatsApi = {
  /** Get total views summary across all content types (admin only). */
  viewsSummary: () => api.get<ViewSummaryItem[]>("/views/admin/summary"),

  /** Get user counts (admin only). */
  userCounts: () => api.get<UserCounts>("/users/counts"),

  /**
   * Fetch all dashboard stats in parallel.
   * Individual failures are caught so the dashboard still renders partial data.
   */
  getDashboardStats: async (): Promise<DashboardStats> => {
    const liveFetch = { cache: "no-store" as const };

    const defaults: DashboardStats = {
      posts: { total: 0, published: 0, draft: 0, pending: 0 },
      media: { total: 0 },
      events: { total: 0, upcoming: 0 },
      attractions: { total: 0 },
      regions: { total: 0 },
      users: {
        total: 0,
        active: 0,
        pending: 0,
        blocked: 0,
        admins: 0,
        editors: 0,
      },
      views: [],
      totalViews: 0,
      totalLikes: 0,
      comments: { pending: 0 },
      videos: { total: 0 },
      hotels: { total: 0 },
      photos: { total: 0 },
    };

    const [
      postsAll,
      postsPublished,
      postsDraft,
      eventsAll,
      eventsUpcoming,
      attractionsAll,
      regionsAll,
      mediaAll,
      userCounts,
      viewsSummary,
      commentsPending,
      videosAll,
      hotelsAll,
      photosAll,
    ] = await Promise.allSettled([
      // Posts counts by status — fetch with limit=1 just to get total
      api.get<PaginatedResponse<PostRaw>>("/posts?limit=1", liveFetch),
      api.get<PaginatedResponse<PostRaw>>(
        "/posts?limit=1&status=published",
        liveFetch,
      ),
      api.get<PaginatedResponse<PostRaw>>(
        "/posts?limit=1&status=draft",
        liveFetch,
      ),
      // Events
      api.get<PaginatedResponse<PostRaw>>("/events?limit=1", liveFetch),
      api.get<PaginatedResponse<PostRaw>>(
        "/events/upcoming?limit=1",
        liveFetch,
      ),
      // Attractions
      api.get<PaginatedResponse<PostRaw>>("/attractions?limit=1", liveFetch),
      // Regions
      api.get<PaginatedResponse<Region>>("/regions?limit=1", liveFetch),
      // Media
      api.get<PaginatedResponse<Media>>("/media?limit=1", liveFetch),
      // Users (admin)
      api.get<UserCounts>("/users/counts", liveFetch),
      // Views (admin)
      api.get<ViewSummaryItem[]>("/views/admin/summary", liveFetch),
      // Comments pending (admin) — use the moderation pending-count endpoint
      api
        .get<{ count: number }>("/comments/moderation/pending-count", liveFetch)
        .catch(() => null),
      // Videos
      api.get<PaginatedResponse<Video>>("/videos?limit=1", liveFetch),
      // Hotels
      api.get<PaginatedResponse<Hotel>>("/hotels?limit=1", liveFetch),
      // Photo Features
      api.get<PaginatedResponse<PhotoFeature>>("/photos?limit=1", liveFetch),
    ]);

    // Extract totals from paginated responses
    if (postsAll.status === "fulfilled")
      defaults.posts.total = postsAll.value.total;
    if (postsPublished.status === "fulfilled")
      defaults.posts.published = postsPublished.value.total;
    if (postsDraft.status === "fulfilled")
      defaults.posts.draft = postsDraft.value.total;
    defaults.posts.pending = Math.max(
      0,
      defaults.posts.total - defaults.posts.published - defaults.posts.draft,
    );

    if (eventsAll.status === "fulfilled")
      defaults.events.total = eventsAll.value.total;
    if (eventsUpcoming.status === "fulfilled")
      defaults.events.upcoming = eventsUpcoming.value.total;

    if (attractionsAll.status === "fulfilled")
      defaults.attractions.total = attractionsAll.value.total;
    if (regionsAll.status === "fulfilled")
      defaults.regions.total = regionsAll.value.total;
    if (mediaAll.status === "fulfilled")
      defaults.media.total = mediaAll.value.total;

    if (userCounts.status === "fulfilled") defaults.users = userCounts.value;

    if (viewsSummary.status === "fulfilled") {
      defaults.views = viewsSummary.value;
      defaults.totalViews = viewsSummary.value.reduce(
        (sum, v) => sum + v.total_views,
        0,
      );
    }

    if (commentsPending.status === "fulfilled" && commentsPending.value) {
      defaults.comments.pending = commentsPending.value.count;
    }

    if (videosAll.status === "fulfilled")
      defaults.videos.total = videosAll.value.total;
    if (hotelsAll.status === "fulfilled")
      defaults.hotels.total = hotelsAll.value.total;
    if (photosAll.status === "fulfilled")
      defaults.photos.total = photosAll.value.total;

    return defaults;
  },
};
