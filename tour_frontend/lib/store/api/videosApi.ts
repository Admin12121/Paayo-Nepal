import { baseApi, buildQueryString } from "./baseApi";
import type {
  Video,
  CreateVideoInput,
  PaginatedResponse,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListVideosParams {
  page?: number;
  limit?: number;
  status?: string;
  region_id?: string;
  is_featured?: boolean;
}

// ---------------------------------------------------------------------------
// Videos API slice — injected into the base API
//
// Videos are their own table (not posts). They have dedicated CRUD endpoints
// under `/videos`, plus publish (draft → published), soft-delete / restore,
// display ordering, and featured toggling.
//
// Each video stores a `platform` (e.g. "youtube", "vimeo"), `video_url`,
// optional `video_id` (platform-specific ID), `thumbnail_url`, and
// `duration` in seconds.
// ---------------------------------------------------------------------------

export const videosApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List videos with optional filters.
     *
     * Cache tags:
     *   - { type: 'Video', id: 'LIST' }
     *   - { type: 'Video', id: '<slug>' } for each item
     */
    listVideos: builder.query<
      PaginatedResponse<Video>,
      ListVideosParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/videos${buildQueryString({
          page: p.page,
          limit: p.limit,
          status: p.status,
          region_id: p.region_id,
          is_featured: p.is_featured,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Video", id: "LIST" }];
        }
        return [
          { type: "Video", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Video" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single video by slug.
     *
     * Cache tags:
     *   - { type: 'Video', id: '<slug>' }
     */
    getVideoBySlug: builder.query<Video, string>({
      query: (slug) => `/videos/by-slug/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: "Video", id: slug }],
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single video by ID.
     *
     * Cache tags:
     *   - { type: 'Video', id: '<id>' }
     */
    getVideoById: builder.query<Video, string>({
      query: (id) => `/videos/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Video", id }],
      keepUnusedDataFor: 300,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new video.
     *
     * Invalidates the video list so it refetches with the new item.
     */
    createVideo: builder.mutation<Video, CreateVideoInput>({
      query: (data) => ({
        url: "/videos",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "Video", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an existing video by ID.
     *
     * Invalidates both the specific video and the list
     * (title/status/featured may change).
     */
    updateVideo: builder.mutation<
      Video,
      { id: string; data: Partial<CreateVideoInput> & { status?: string } }
    >({
      query: ({ id, data }) => ({
        url: `/videos/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: "Video", id },
        { type: "Video", id: result?.slug || id },
        { type: "Video", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Delete a video by ID (soft delete).
     *
     * Invalidates the list and removes the specific cache entry.
     */
    deleteVideo: builder.mutation<void, string>({
      query: (id) => ({
        url: `/videos/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Video", id },
        { type: "Video", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Publish a video (draft → published).
     *
     * Uses the PUT /videos/:id/status endpoint with `status: "published"`.
     */
    publishVideo: builder.mutation<Video, string>({
      query: (id) => ({
        url: `/videos/${id}/status`,
        method: "PUT",
        body: { status: "published" },
      }),
      invalidatesTags: (result, _error, id) => [
        { type: "Video", id },
        { type: "Video", id: result?.slug || id },
        { type: "Video", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update a video's display order.
     *
     * Used for manual sorting in the admin dashboard. Pass `null` to
     * remove the custom order (falls back to default sorting).
     */
    updateVideoDisplayOrder: builder.mutation<
      Video,
      { id: string; display_order: number | null }
    >({
      query: ({ id, display_order }) => ({
        url: `/videos/${id}/display-order`,
        method: "PUT",
        body: { display_order },
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: "Video", id },
        { type: "Video", id: result?.slug || id },
        { type: "Video", id: "LIST" },
      ],
    }),

    /**
     * Restore a soft-deleted video.
     *
     * Brings back a previously deleted video and re-adds it to lists.
     */
    restoreVideo: builder.mutation<Video, string>({
      query: (id) => ({
        url: `/videos/${id}/restore`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (result, _error, id) => [
        { type: "Video", id },
        { type: "Video", id: result?.slug || id },
        { type: "Video", id: "LIST" },
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
//     useListVideosQuery,
//     useGetVideoBySlugQuery,
//     useGetVideoByIdQuery,
//     useCreateVideoMutation,
//     useUpdateVideoMutation,
//     useDeleteVideoMutation,
//     usePublishVideoMutation,
//     useUpdateVideoDisplayOrderMutation,
//     useRestoreVideoMutation,
//   } from "@/lib/store/api/videosApi";
//
//   // List videos with filters
//   const { data, isLoading } = useListVideosQuery({
//     page: 1,
//     limit: 20,
//     status: "published",
//   });
//
//   // Get a single video by slug
//   const { data: video } = useGetVideoBySlugQuery("nepal-trekking-guide");
//
//   // Create a new video
//   const [createVideo, { isLoading: creating }] = useCreateVideoMutation();
//   await createVideo({
//     title: "Nepal Trekking Guide",
//     video_url: "https://youtube.com/watch?v=abc123",
//     platform: "youtube",
//   }).unwrap();
//
//   // Update a video
//   const [updateVideo] = useUpdateVideoMutation();
//   await updateVideo({
//     id: videoId,
//     data: { title: "Updated Title", is_featured: true },
//   }).unwrap();
//
//   // Publish a video
//   const [publishVideo] = usePublishVideoMutation();
//   await publishVideo(videoId).unwrap();
//
//   // Delete a video (soft delete)
//   const [deleteVideo, { isLoading: deleting }] = useDeleteVideoMutation();
//   await deleteVideo(videoId).unwrap();
//
//   // Restore a soft-deleted video
//   const [restoreVideo] = useRestoreVideoMutation();
//   await restoreVideo(videoId).unwrap();
//
//   // Update display order
//   const [updateOrder] = useUpdateVideoDisplayOrderMutation();
//   await updateOrder({ id: videoId, display_order: 3 }).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListVideosQuery,
  useGetVideoBySlugQuery,
  useGetVideoByIdQuery,
  useCreateVideoMutation,
  useUpdateVideoMutation,
  useDeleteVideoMutation,
  usePublishVideoMutation,
  useUpdateVideoDisplayOrderMutation,
  useRestoreVideoMutation,
} = videosApi;
