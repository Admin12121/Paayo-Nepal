// API base URL - internal Docker network URL for server-side, public URL for client-side
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://backend:8080/api"
    : "/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
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

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Server-side: extract the raw session token from better-auth's signed cookie
    // and forward it to the Rust backend which expects the raw token
    if (typeof window === "undefined") {
      try {
        const { headers: getHeaders } = await import("next/headers");
        const { auth } = await import("@/lib/auth-server");
        const reqHeaders = await getHeaders();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (session?.session?.token) {
          headers["Cookie"] =
            `better-auth.session_token=${session.session.token}`;
        }
      } catch {
        // Session not available or headers() not in request context
      }
    }

    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, tags, revalidate, cache } = options;

    const fetchOptions: RequestInit & {
      next?: { tags?: string[]; revalidate?: number | false };
    } = {
      method,
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    };

    // Add Next.js cache options for server components
    if (typeof window === "undefined") {
      fetchOptions.next = {
        tags,
        revalidate,
      };
      if (cache) {
        fetchOptions.cache = cache;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        error.message || `API Error: ${response.statusText}`,
        error.details,
      );
    }

    return response.json();
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

export const api = new ApiClient(API_BASE_URL);

// Pagination response type
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============= Posts API =============
export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  featured_image_blur: string | null;
  post_type: string;
  status: string;
  author_id: string;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  views: number;
  likes: number;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePostInput {
  title: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
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
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.type) searchParams.set("post_type", params.type);
    return api.get<PaginatedResponse<Post>>(`/posts?${searchParams}`, {
      tags: ["posts"],
      revalidate: 60,
    });
  },

  getBySlug: (slug: string) =>
    api.get<Post>(`/posts/${slug}`, {
      tags: [`post-${slug}`],
      revalidate: 60,
    }),

  create: (data: CreatePostInput) => api.post<Post>("/posts", data),

  update: (slug: string, data: Partial<CreatePostInput>) =>
    api.put<Post>(`/posts/${slug}`, data),

  delete: (slug: string) => api.delete(`/posts/${slug}`),

  publish: (id: string) => api.post<Post>(`/posts/${id}/publish`, {}),

  approve: (id: string) => api.post<Post>(`/posts/${id}/approve`, {}),
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
export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  featured_image: string | null;
  featured_image_blur: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  region_id: string | null;
  is_featured: boolean;
  views: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

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
    return api.get<PaginatedResponse<Event>>(`/events?${searchParams}`, {
      tags: ["events"],
      revalidate: 300,
    });
  },

  upcoming: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<PaginatedResponse<Event>>(
      `/events/upcoming?${searchParams}`,
      {
        tags: ["events-upcoming"],
        revalidate: 300,
      },
    );
  },

  getBySlug: (slug: string) =>
    api.get<Event>(`/events/${slug}`, {
      tags: [`event-${slug}`],
      revalidate: 300,
    }),
};

// ============= Regions API =============
export interface Region {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  featured_image: string | null;
  featured_image_blur: string | null;
  latitude: number | null;
  longitude: number | null;
  province: string | null;
  district: string | null;
  display_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
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
    return api.get<PaginatedResponse<Attraction>>(
      `/regions/${slug}/attractions?${searchParams}`,
    );
  },
};

// ============= Attractions API =============
export interface Attraction {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string | null;
  featured_image: string | null;
  featured_image_blur: string | null;
  region_id: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  opening_hours: Record<string, { open: string; close: string }> | null;
  entry_fee: string | null;
  is_top_attraction: boolean;
  views: number;
  rating: number | null;
  review_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const attractionsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    region_id?: string;
    is_top?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.region_id) searchParams.set("region_id", params.region_id);
    if (params?.is_top !== undefined)
      searchParams.set("is_top", String(params.is_top));
    return api.get<PaginatedResponse<Attraction>>(
      `/attractions?${searchParams}`,
      {
        tags: ["attractions"],
        revalidate: 300,
      },
    );
  },

  top: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<PaginatedResponse<Attraction>>(
      `/attractions/top?${searchParams}`,
      {
        tags: ["attractions-top"],
        revalidate: 300,
      },
    );
  },

  getBySlug: (slug: string) =>
    api.get<Attraction>(`/attractions/${slug}`, {
      tags: [`attraction-${slug}`],
      revalidate: 300,
    }),
};

// ============= Activities API =============
export interface Activity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string | null;
  featured_image: string | null;
  featured_image_blur: string | null;
  hero_image: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const activitiesApi = {
  list: (params?: { page?: number; limit?: number; is_active?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.is_active !== undefined)
      searchParams.set("is_active", String(params.is_active));
    return api.get<PaginatedResponse<Activity>>(`/activities?${searchParams}`, {
      tags: ["activities"],
      revalidate: 3600,
    });
  },

  getBySlug: (slug: string) =>
    api.get<Activity>(`/activities/${slug}`, {
      tags: [`activity-${slug}`],
      revalidate: 3600,
    }),
};

// ============= Search API =============
export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
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
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  created_at: string;
  updated_at: string;
}

export const commentsApi = {
  listForPost: (postId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<PaginatedResponse<Comment>>(
      `/posts/${postId}/comments?${searchParams}`,
    );
  },

  create: (postId: string, data: { content: string; parent_id?: string }) =>
    api.post<Comment>(`/posts/${postId}/comments`, data),

  update: (id: string, content: string) =>
    api.put<Comment>(`/comments/${id}`, { content }),

  delete: (id: string) => api.delete(`/comments/${id}`),

  like: (id: string) =>
    api.post<{ liked: boolean }>(`/comments/${id}/like`, {}),
};
