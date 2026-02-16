import { baseApi, buildQueryString, provideListTags } from "./baseApi";
import type { Media, PaginatedResponse } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListMediaParams {
  page?: number;
  limit?: number;
  type?: string;
}

export interface GalleryParams {
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Media API slice — injected into the base API
//
// Handles media file listing, gallery views, individual lookups, uploads,
// and deletions. File uploads use multipart/form-data (FormData body) so
// the Content-Type header is NOT set — the browser sets it automatically
// with the correct multipart boundary.
// ---------------------------------------------------------------------------

export const mediaApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List media files with optional filters.
     *
     * Cache tags:
     *   - { type: 'Media', id: 'LIST' }
     *   - { type: 'Media', id: '<id>' } for each item
     */
    listMedia: builder.query<PaginatedResponse<Media>, ListMediaParams | void>({
      query: (params) => {
        const p = params ?? {};
        return `/media${buildQueryString({
          page: p.page,
          limit: p.limit,
          media_type: p.type,
        })}`;
      },
      providesTags: provideListTags<Media, "Media">("Media"),
      keepUnusedDataFor: 120,
    }),

    /**
     * List media for public gallery view.
     *
     * Separate from `listMedia` because the backend may apply different
     * filters (e.g., only published / approved images).
     */
    listGallery: builder.query<PaginatedResponse<Media>, GalleryParams | void>({
      query: (params) => {
        const p = params ?? {};
        return `/media/gallery${buildQueryString({
          page: p.page,
          limit: p.limit,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Media", id: "GALLERY" }];
        }
        return [
          { type: "Media", id: "GALLERY" },
          ...result.data.map((item) => ({ type: "Media" as const, id: item.id })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single media item by ID.
     */
    getMedia: builder.query<Media, string>({
      query: (id) => `/media/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Media", id }],
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Upload a media file.
     *
     * Accepts a FormData body containing the file and optional metadata.
     * The Content-Type header is intentionally omitted so the browser can
     * set it to `multipart/form-data` with the correct boundary string.
     *
     * Usage:
     *   const [uploadMedia, { isLoading }] = useUploadMediaMutation();
     *
     *   const formData = new FormData();
     *   formData.append("file", fileInput.files[0]);
     *   formData.append("alt", "Sunset over Pokhara");
     *
     *   await uploadMedia(formData).unwrap();
     */
    uploadMedia: builder.mutation<Media, FormData>({
      query: (formData) => ({
        url: "/media",
        method: "POST",
        body: formData,
        // IMPORTANT: Do NOT set Content-Type — the browser must set it
        // automatically with the multipart boundary. RTK Query's
        // fetchBaseQuery will try to set Content-Type to application/json
        // via our prepareHeaders, so we override it here by explicitly
        // removing it. We achieve this by using formData directly; fetch()
        // knows not to set Content-Type when the body is FormData.
        headers: {
          // Override the default Content-Type from prepareHeaders.
          // Setting to undefined or empty string would not work with
          // Headers API, so we delete it in prepareHeaders instead.
          // Actually, fetchBaseQuery handles FormData correctly by
          // stripping Content-Type. But just in case, we signal it here.
        },
        formData: true,
      }),
      invalidatesTags: [
        { type: "Media", id: "LIST" },
        { type: "Media", id: "GALLERY" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update media metadata (alt text, caption, etc.)
     */
    updateMedia: builder.mutation<
      Media,
      { id: string; data: { alt?: string; caption?: string } }
    >({
      query: ({ id, data }) => ({
        url: `/media/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Media", id },
        { type: "Media", id: "LIST" },
        { type: "Media", id: "GALLERY" },
      ],
    }),

    /**
     * Delete a media file.
     *
     * Removes the file from storage and the database record.
     * Invalidates both the specific item cache and all list views.
     */
    deleteMedia: builder.mutation<void, string>({
      query: (id) => ({
        url: `/media/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Media", id },
        { type: "Media", id: "LIST" },
        { type: "Media", id: "GALLERY" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Batch delete multiple media files.
     *
     * Useful for bulk operations in the media management dashboard.
     */
    batchDeleteMedia: builder.mutation<{ deleted: number }, string[]>({
      query: (ids) => ({
        url: "/media/batch/delete",
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: [
        { type: "Media", id: "LIST" },
        { type: "Media", id: "GALLERY" },
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
//   import { useListMediaQuery, useUploadMediaMutation } from "@/lib/store/api/mediaApi";
//
//   // List media with pagination
//   const { data, isLoading } = useListMediaQuery({ page: 1, limit: 20 });
//
//   // Upload a file
//   const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();
//   const formData = new FormData();
//   formData.append("file", file);
//   await uploadMedia(formData).unwrap();
//
//   // Delete a media item
//   const [deleteMedia] = useDeleteMediaMutation();
//   await deleteMedia(mediaId).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListMediaQuery,
  useListGalleryQuery,
  useGetMediaQuery,
  useUploadMediaMutation,
  useUpdateMediaMutation,
  useDeleteMediaMutation,
  useBatchDeleteMediaMutation,
} = mediaApi;
