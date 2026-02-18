import { baseApi, buildQueryString } from "./baseApi";
import type {
  PhotoFeature,
  PhotoImage,
  CreatePhotoFeatureInput,
  PaginatedResponse,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListPhotosParams {
  page?: number;
  limit?: number;
  status?: string;
  is_featured?: boolean;
}

// ---------------------------------------------------------------------------
// Photos API slice — injected into the base API
//
// Photo features are their own table (`photo_features`) with a child table
// (`photo_images`) for individual images within a feature. They have
// dedicated CRUD endpoints under `/photos`, plus image management under
// `/photos/:id/images`.
//
// Photo features also support soft-delete / restore, publish
// (draft → published), display ordering, and featured toggling.
// ---------------------------------------------------------------------------

export const photosApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List photo features with optional filters.
     *
     * Cache tags:
     *   - { type: 'Photo', id: 'LIST' }
     *   - { type: 'Photo', id: '<slug>' } for each item
     */
    listPhotos: builder.query<
      PaginatedResponse<PhotoFeature>,
      ListPhotosParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/photos${buildQueryString({
          page: p.page,
          limit: p.limit,
          status: p.status,
          is_featured: p.is_featured,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Photo", id: "LIST" }];
        }
        return [
          { type: "Photo", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Photo" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 0,
    }),

    /**
     * Get a single photo feature by slug.
     *
     * Cache tags:
     *   - { type: 'Photo', id: '<slug>' }
     */
    getPhotoBySlug: builder.query<PhotoFeature, string>({
      query: (slug) => `/photos/by-slug/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: "Photo", id: slug }],
      keepUnusedDataFor: 0,
    }),

    /**
     * Get a single photo feature by ID.
     *
     * Cache tags:
     *   - { type: 'Photo', id: '<id>' }
     */
    getPhotoById: builder.query<PhotoFeature, string>({
      query: (id) => `/photos/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Photo", id }],
      keepUnusedDataFor: 0,
    }),

    /**
     * List images within a photo feature.
     *
     * Cache tags:
     *   - { type: 'Photo', id: '<photoId>-images' }
     */
    listPhotoImages: builder.query<PhotoImage[], string>({
      query: (photoId) => `/photos/${photoId}/images`,
      providesTags: (_result, _error, photoId) => [
        { type: "Photo", id: `${photoId}-images` },
      ],
      keepUnusedDataFor: 0,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new photo feature.
     *
     * Invalidates the photo list so it refetches with the new item.
     */
    createPhoto: builder.mutation<PhotoFeature, CreatePhotoFeatureInput>({
      query: (data) => {
        const normalized = {
          ...data,
          region_id: data.region_id || undefined,
        };
        return {
          url: "/photos",
          method: "POST",
          body: normalized,
        };
      },
      invalidatesTags: [
        { type: "Photo", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an existing photo feature by ID.
     *
     * Invalidates both the specific photo and the list
     * (title/status/featured may change).
     */
    updatePhoto: builder.mutation<
      PhotoFeature,
      {
        id: string;
        data: Partial<CreatePhotoFeatureInput> & { status?: string };
      }
    >({
      query: ({ id, data }) => {
        const normalized = {
          ...data,
          region_id:
            Object.prototype.hasOwnProperty.call(data, "region_id") &&
            data.region_id !== undefined
              ? data.region_id.trim()
              : undefined,
        };
        return {
          url: `/photos/${id}`,
          method: "PUT",
          body: normalized,
        };
      },
      invalidatesTags: (result, _error, { id }) => [
        { type: "Photo", id },
        { type: "Photo", id: result?.slug || id },
        { type: "Photo", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Delete a photo feature by ID (soft delete).
     *
     * Invalidates the list and removes the specific cache entry.
     */
    deletePhoto: builder.mutation<void, string>({
      query: (id) => ({
        url: `/photos/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Photo", id },
        { type: "Photo", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Publish a photo feature (draft → published).
     *
     * Uses the PUT /photos/:id/status endpoint with `status: "published"`.
     */
    publishPhoto: builder.mutation<PhotoFeature, string>({
      query: (id) => ({
        url: `/photos/${id}/status`,
        method: "PUT",
        body: { status: "published" },
      }),
      invalidatesTags: (result, _error, id) => [
        { type: "Photo", id },
        { type: "Photo", id: result?.slug || id },
        { type: "Photo", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update a photo feature's display order.
     *
     * Used for manual sorting in the admin dashboard. Pass `null` to
     * remove the custom order (falls back to default sorting).
     */
    updatePhotoDisplayOrder: builder.mutation<
      PhotoFeature,
      { id: string; display_order: number | null }
    >({
      query: ({ id, display_order }) => ({
        url: `/photos/${id}/display-order`,
        method: "PUT",
        body: { display_order },
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: "Photo", id },
        { type: "Photo", id: result?.slug || id },
        { type: "Photo", id: "LIST" },
      ],
    }),

    /**
     * Restore a soft-deleted photo feature.
     *
     * Brings back a previously deleted photo feature and re-adds it to lists.
     */
    restorePhoto: builder.mutation<PhotoFeature, string>({
      query: (id) => ({
        url: `/photos/${id}/restore`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (result, _error, id) => [
        { type: "Photo", id },
        { type: "Photo", id: result?.slug || id },
        { type: "Photo", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    // ─── Image Management Mutations ──────────────────────────────────

    /**
     * Add an image to a photo feature.
     *
     * Invalidates the photo's image list and the photo itself
     * (the `images` array on the photo feature will be stale).
     */
    addPhotoImage: builder.mutation<
      PhotoImage,
      {
        photoId: string;
        data: { image_url: string; caption?: string; display_order?: number };
      }
    >({
      query: ({ photoId, data }) => ({
        url: `/photos/${photoId}/images`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { photoId }) => [
        { type: "Photo", id: `${photoId}-images` },
        { type: "Photo", id: photoId },
        { type: "Photo", id: "LIST" },
      ],
    }),

    /**
     * Update an image within a photo feature (caption, display_order).
     *
     * Invalidates the photo's image list and the photo itself.
     */
    updatePhotoImage: builder.mutation<
      PhotoImage,
      {
        photoId: string;
        imageId: string;
        data: { caption?: string; display_order?: number };
      }
    >({
      query: ({ photoId, imageId, data }) => ({
        url: `/photos/${photoId}/images/${imageId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { photoId }) => [
        { type: "Photo", id: `${photoId}-images` },
        { type: "Photo", id: photoId },
        { type: "Photo", id: "LIST" },
      ],
    }),

    /**
     * Remove an image from a photo feature.
     *
     * Invalidates the photo's image list and the photo itself.
     */
    removePhotoImage: builder.mutation<
      void,
      { photoId: string; imageId: string }
    >({
      query: ({ photoId, imageId }) => ({
        url: `/photos/${photoId}/images/${imageId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { photoId }) => [
        { type: "Photo", id: `${photoId}-images` },
        { type: "Photo", id: photoId },
        { type: "Photo", id: "LIST" },
      ],
    }),

    /**
     * Reorder images within a photo feature.
     *
     * Accepts an array of `{ id, display_order }` objects defining the
     * new order for all images. Invalidates the image list cache.
     */
    reorderPhotoImages: builder.mutation<
      void,
      {
        photoId: string;
        orders: { id: string; display_order: number }[];
      }
    >({
      query: ({ photoId, orders }) => ({
        url: `/photos/${photoId}/images/reorder`,
        method: "PUT",
        body: {
          image_ids: [...orders]
            .sort((a, b) => a.display_order - b.display_order)
            .map((item) => item.id),
        },
      }),
      invalidatesTags: (_result, _error, { photoId }) => [
        { type: "Photo", id: `${photoId}-images` },
        { type: "Photo", id: photoId },
        { type: "Photo", id: "LIST" },
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
//     useListPhotosQuery,
//     useGetPhotoBySlugQuery,
//     useGetPhotoByIdQuery,
//     useListPhotoImagesQuery,
//     useCreatePhotoMutation,
//     useUpdatePhotoMutation,
//     useDeletePhotoMutation,
//     usePublishPhotoMutation,
//     useUpdatePhotoDisplayOrderMutation,
//     useRestorePhotoMutation,
//     useAddPhotoImageMutation,
//     useUpdatePhotoImageMutation,
//     useRemovePhotoImageMutation,
//     useReorderPhotoImagesMutation,
//   } from "@/lib/store/api/photosApi";
//
//   // List photo features with filters
//   const { data, isLoading } = useListPhotosQuery({
//     page: 1,
//     limit: 20,
//     status: "published",
//   });
//
//   // Get a single photo feature by slug
//   const { data: photo } = useGetPhotoBySlugQuery("sunrise-over-himalayas");
//
//   // Get images within a photo feature
//   const { data: images } = useListPhotoImagesQuery(photoId);
//
//   // Create a new photo feature
//   const [createPhoto, { isLoading: creating }] = useCreatePhotoMutation();
//   await createPhoto({
//     title: "Sunrise Over Himalayas",
//     description: "A stunning collection of sunrise photos",
//   }).unwrap();
//
//   // Add an image to a photo feature
//   const [addImage] = useAddPhotoImageMutation();
//   await addImage({
//     photoId,
//     data: {
//       image_url: "/uploads/images/sunrise-01.jpg",
//       caption: "First light on Everest",
//       display_order: 1,
//     },
//   }).unwrap();
//
//   // Reorder images
//   const [reorder] = useReorderPhotoImagesMutation();
//   await reorder({
//     photoId,
//     orders: [
//       { id: "img-1", display_order: 0 },
//       { id: "img-2", display_order: 1 },
//       { id: "img-3", display_order: 2 },
//     ],
//   }).unwrap();
//
//   // Delete a photo feature (soft delete)
//   const [deletePhoto, { isLoading: deleting }] = useDeletePhotoMutation();
//   await deletePhoto(photoId).unwrap();
//
//   // Restore a soft-deleted photo feature
//   const [restorePhoto] = useRestorePhotoMutation();
//   await restorePhoto(photoId).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListPhotosQuery,
  useGetPhotoBySlugQuery,
  useGetPhotoByIdQuery,
  useListPhotoImagesQuery,
  useCreatePhotoMutation,
  useUpdatePhotoMutation,
  useDeletePhotoMutation,
  usePublishPhotoMutation,
  useUpdatePhotoDisplayOrderMutation,
  useRestorePhotoMutation,
  useAddPhotoImageMutation,
  useUpdatePhotoImageMutation,
  useRemovePhotoImageMutation,
  useReorderPhotoImagesMutation,
} = photosApi;
