import { baseApi, buildQueryString } from "./baseApi";
import type { Post, PaginatedResponse } from "@/lib/api-client";
import { enrichPost, enrichPaginated, type PostRaw } from "./postsApi";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListActivitiesParams {
  page?: number;
  limit?: number;
  is_featured?: boolean;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Activities API slice — injected into the base API
//
// Activities are stored in the `posts` table with `type = 'activity'`.
// The backend exposes them under `/activities` with dedicated endpoints.
// The enrichment layer flattens JSONB `content` fields like `icon`.
// ---------------------------------------------------------------------------

export const activitiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List activities with optional filters.
     *
     * Cache tags:
     *   - { type: 'Activity', id: 'LIST' }
     *   - { type: 'Activity', id: '<slug>' } for each item
     */
    listActivities: builder.query<
      PaginatedResponse<Post>,
      ListActivitiesParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/activities${buildQueryString({
          page: p.page,
          limit: p.limit,
          is_featured: p.is_featured,
          // Backend uses `status` param to filter active/inactive
          status: p.is_active === true ? "published" : p.is_active === false ? "draft" : undefined,
        })}`;
      },
      transformResponse: (response: PaginatedResponse<PostRaw>) =>
        enrichPaginated(response),
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Activity", id: "LIST" }];
        }
        return [
          { type: "Activity", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Activity" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 3600,
    }),

    /**
     * Get a single activity by slug.
     *
     * Cache tags:
     *   - { type: 'Activity', id: '<slug>' }
     */
    getActivityBySlug: builder.query<Post, string>({
      query: (slug) => `/activities/${slug}`,
      transformResponse: (response: PostRaw) => enrichPost(response),
      providesTags: (_result, _error, slug) => [
        { type: "Activity", id: slug },
      ],
      keepUnusedDataFor: 3600,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new activity.
     * Uses the /activities POST endpoint.
     */
    createActivity: builder.mutation<
      Post,
      {
        title: string;
        short_description?: string | null;
        content?: unknown | null;
        cover_image?: string | null;
        icon?: string | null;
        is_featured?: boolean;
      }
    >({
      query: (data) => ({
        url: "/activities",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [
        { type: "Activity", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an existing activity by slug.
     * Uses the /activities/:slug PUT endpoint.
     *
     * Invalidates both the specific activity and the list
     * (status/title/featured may change).
     */
    updateActivity: builder.mutation<
      Post,
      {
        slug: string;
        data: {
          title?: string;
          short_description?: string | null;
          content?: unknown | null;
          cover_image?: string | null;
          icon?: string | null;
          is_featured?: boolean;
        };
      }
    >({
      query: ({ slug, data }) => ({
        url: `/activities/${slug}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: (_result, _error, { slug }) => [
        { type: "Activity", id: slug },
        { type: "Activity", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Delete an activity by slug.
     * Uses the /activities/:slug DELETE endpoint.
     *
     * Invalidates the list and removes the specific cache entry.
     */
    deleteActivity: builder.mutation<void, string>({
      query: (slug) => ({
        url: `/activities/${slug}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Activity", id: slug },
        { type: "Activity", id: "LIST" },
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
//     useListActivitiesQuery,
//     useGetActivityBySlugQuery,
//     useCreateActivityMutation,
//     useUpdateActivityMutation,
//     useDeleteActivityMutation,
//   } from "@/lib/store/api/activitiesApi";
//
//   // List all activities
//   const { data, isLoading } = useListActivitiesQuery({ page: 1, limit: 20 });
//
//   // Get a single activity by slug
//   const { data: activity } = useGetActivityBySlugQuery("paragliding");
//
//   // Create a new activity
//   const [createActivity, { isLoading: creating }] = useCreateActivityMutation();
//   await createActivity({ title: "Paragliding", icon: "🪂" }).unwrap();
//
//   // Update an activity
//   const [updateActivity, { isLoading: updating }] = useUpdateActivityMutation();
//   await updateActivity({ slug: "paragliding", data: { is_featured: true } }).unwrap();
//
//   // Delete an activity
//   const [deleteActivity, { isLoading: deleting }] = useDeleteActivityMutation();
//   await deleteActivity("paragliding").unwrap();
// ---------------------------------------------------------------------------

export const {
  useListActivitiesQuery,
  useGetActivityBySlugQuery,
  useCreateActivityMutation,
  useUpdateActivityMutation,
  useDeleteActivityMutation,
} = activitiesApi;
