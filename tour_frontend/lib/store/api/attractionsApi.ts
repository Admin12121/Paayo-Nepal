import { baseApi, buildQueryString } from "./baseApi";
import type { Post, PaginatedResponse } from "@/lib/api-client";
import { enrichPost, enrichPaginated, type PostRaw } from "./postsApi";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListAttractionsParams {
  page?: number;
  limit?: number;
  region_id?: string;
  is_featured?: boolean;
}

export interface TopAttractionsParams {
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Attractions API slice — injected into the base API
//
// Attractions are stored in the `posts` table with `type = 'explore'`.
// The backend exposes them under `/attractions` with dedicated endpoints.
// The enrichment layer flattens JSONB `content` fields like `rating`,
// `address`, `entry_fee`, `opening_hours`, `latitude`, `longitude`, etc.
// ---------------------------------------------------------------------------

export const attractionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List attractions with optional filters.
     *
     * Cache tags:
     *   - { type: 'Attraction', id: 'LIST' }
     *   - { type: 'Attraction', id: '<slug>' } for each item
     */
    listAttractions: builder.query<
      PaginatedResponse<Post>,
      ListAttractionsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/attractions${buildQueryString({
          page: p.page,
          limit: p.limit,
          region_id: p.region_id,
          is_featured: p.is_featured,
        })}`;
      },
      transformResponse: (response: PaginatedResponse<PostRaw>) =>
        enrichPaginated(response),
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Attraction", id: "LIST" }];
        }
        return [
          { type: "Attraction", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Attraction" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * List top attractions (sorted by attraction_rank / featured-first).
     *
     * Cache tags:
     *   - { type: 'Attraction', id: 'TOP' }
     *   - { type: 'Attraction', id: '<slug>' } for each item
     */
    listTopAttractions: builder.query<
      PaginatedResponse<Post>,
      TopAttractionsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/attractions/top${buildQueryString({
          page: p.page,
          limit: p.limit,
        })}`;
      },
      transformResponse: (response: PaginatedResponse<PostRaw>) =>
        enrichPaginated(response),
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Attraction", id: "TOP" }];
        }
        return [
          { type: "Attraction", id: "TOP" },
          ...result.data.map((item) => ({
            type: "Attraction" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single attraction by slug.
     *
     * Cache tags:
     *   - { type: 'Attraction', id: '<slug>' }
     */
    getAttractionBySlug: builder.query<Post, string>({
      query: (slug) => `/attractions/${slug}`,
      transformResponse: (response: PostRaw) => enrichPost(response),
      providesTags: (_result, _error, slug) => [
        { type: "Attraction", id: slug },
      ],
      keepUnusedDataFor: 300,
    }),

    // ─── Mutations ───────────────────────────────────────────────────
    // Attractions are created/updated/deleted via the Posts API (they
    // share the same `posts` table with `type = 'explore'`).
    //
    // Use `useCreatePostMutation` etc. from postsApi with
    // `post_type: 'explore'`. Mutations on posts will invalidate 'Post'
    // tags. If you also want attraction lists to refetch, you can
    // manually invalidate 'Attraction' tags from the calling code:
    //
    //   dispatch(baseApi.util.invalidateTags([{ type: 'Attraction', id: 'LIST' }]));
    //
    // Alternatively, add attraction-specific create/update/delete
    // mutations here if the backend has dedicated endpoints for them.

    /**
     * Delete an attraction by slug.
     * Uses the /attractions/:slug DELETE endpoint.
     */
    deleteAttraction: builder.mutation<void, string>({
      query: (slug) => ({
        url: `/attractions/${slug}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Attraction", id: slug },
        { type: "Attraction", id: "LIST" },
        { type: "Attraction", id: "TOP" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Create an attraction.
     * Uses the /attractions POST endpoint.
     */
    createAttraction: builder.mutation<
      Post,
      {
        title: string;
        short_description?: string | null;
        content?: unknown | null;
        cover_image?: string | null;
        region_id?: string | null;
        is_featured?: boolean;
      }
    >({
      query: (data) => ({
        url: "/attractions",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [
        { type: "Attraction", id: "LIST" },
        { type: "Attraction", id: "TOP" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an attraction by slug.
     * Uses the /attractions/:slug PUT endpoint.
     */
    updateAttraction: builder.mutation<
      Post,
      {
        slug: string;
        data: {
          title?: string;
          short_description?: string | null;
          content?: unknown | null;
          cover_image?: string | null;
          region_id?: string | null;
          is_featured?: boolean;
          status?: string;
        };
      }
    >({
      query: ({ slug, data }) => ({
        url: `/attractions/${slug}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: (result, _error, { slug }) => [
        { type: "Attraction", id: slug },
        { type: "Attraction", id: result?.slug || slug },
        { type: "Attraction", id: "LIST" },
        { type: "Attraction", id: "TOP" },
        { type: "DashboardStats" },
      ],
    }),
  }),

  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks
//
// Usage:
//   import {
//     useListAttractionsQuery,
//     useListTopAttractionsQuery,
//     useGetAttractionBySlugQuery,
//     useDeleteAttractionMutation,
//     useCreateAttractionMutation,
//     useUpdateAttractionMutation,
//   } from "@/lib/store/api/attractionsApi";
//
//   // List all attractions
//   const { data, isLoading } = useListAttractionsQuery({ page: 1, limit: 20 });
//
//   // List top attractions for homepage
//   const { data: top } = useListTopAttractionsQuery({ limit: 8 });
//
//   // Get a single attraction by slug
//   const { data: attraction } = useGetAttractionBySlugQuery("swayambhunath");
//
//   // Delete an attraction
//   const [deleteAttraction, { isLoading: deleting }] = useDeleteAttractionMutation();
//   await deleteAttraction("swayambhunath").unwrap();
// ---------------------------------------------------------------------------

export const {
  useListAttractionsQuery,
  useListTopAttractionsQuery,
  useGetAttractionBySlugQuery,
  useDeleteAttractionMutation,
  useCreateAttractionMutation,
  useUpdateAttractionMutation,
} = attractionsApi;
