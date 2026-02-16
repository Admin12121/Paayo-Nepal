import { baseApi, buildQueryString } from "./baseApi";
import type {
  Hotel,
  HotelBranch,
  CreateHotelInput,
  CreateBranchInput,
  PaginatedResponse,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListHotelsParams {
  page?: number;
  limit?: number;
  status?: string;
  region_id?: string;
  price_range?: string;
  is_featured?: boolean;
}

// ---------------------------------------------------------------------------
// Hotels API slice — injected into the base API
//
// Hotels are their own table (not posts). They have dedicated CRUD endpoints
// under `/hotels`, plus branch management under `/hotels/:id/branches`.
//
// Hotels also support soft-delete / restore, publish (draft → published),
// display ordering, and featured toggling.
// ---------------------------------------------------------------------------

export const hotelsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List hotels with optional filters.
     *
     * Cache tags:
     *   - { type: 'Hotel', id: 'LIST' }
     *   - { type: 'Hotel', id: '<slug>' } for each item
     */
    listHotels: builder.query<
      PaginatedResponse<Hotel>,
      ListHotelsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/hotels${buildQueryString({
          page: p.page,
          limit: p.limit,
          status: p.status,
          region_id: p.region_id,
          price_range: p.price_range,
          is_featured: p.is_featured,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Hotel", id: "LIST" }];
        }
        return [
          { type: "Hotel", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Hotel" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single hotel by slug.
     *
     * Cache tags:
     *   - { type: 'Hotel', id: '<slug>' }
     */
    getHotelBySlug: builder.query<Hotel, string>({
      query: (slug) => `/hotels/by-slug/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: "Hotel", id: slug }],
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single hotel by ID.
     *
     * Cache tags:
     *   - { type: 'Hotel', id: '<id>' }
     */
    getHotelById: builder.query<Hotel, string>({
      query: (id) => `/hotels/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Hotel", id }],
      keepUnusedDataFor: 300,
    }),

    /**
     * Get branches for a specific hotel.
     *
     * Cache tags:
     *   - { type: 'Hotel', id: '<hotelId>-branches' }
     */
    getHotelBranches: builder.query<HotelBranch[], string>({
      query: (hotelId) => `/hotels/${hotelId}/branches`,
      providesTags: (_result, _error, hotelId) => [
        { type: "Hotel", id: `${hotelId}-branches` },
      ],
      keepUnusedDataFor: 300,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new hotel.
     *
     * Invalidates the hotel list so it refetches with the new item.
     */
    createHotel: builder.mutation<Hotel, CreateHotelInput>({
      query: (data) => ({
        url: "/hotels",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "Hotel", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an existing hotel by ID.
     *
     * Invalidates both the specific hotel and the list
     * (name/status/featured may change).
     */
    updateHotel: builder.mutation<
      Hotel,
      { id: string; data: Partial<CreateHotelInput> & { status?: string } }
    >({
      query: ({ id, data }) => ({
        url: `/hotels/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: "Hotel", id },
        { type: "Hotel", id: result?.slug || id },
        { type: "Hotel", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Delete a hotel by ID (soft delete).
     *
     * Invalidates the list and removes the specific cache entry.
     */
    deleteHotel: builder.mutation<void, string>({
      query: (id) => ({
        url: `/hotels/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Hotel", id },
        { type: "Hotel", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Publish a hotel (draft → published).
     *
     * Uses the PUT /hotels/:id/status endpoint with `status: "published"`.
     */
    publishHotel: builder.mutation<Hotel, string>({
      query: (id) => ({
        url: `/hotels/${id}/status`,
        method: "PUT",
        body: { status: "published" },
      }),
      invalidatesTags: (result, _error, id) => [
        { type: "Hotel", id },
        { type: "Hotel", id: result?.slug || id },
        { type: "Hotel", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update a hotel's display order.
     *
     * Used for manual sorting in the admin dashboard. Pass `null` to
     * remove the custom order (falls back to default sorting).
     */
    updateHotelDisplayOrder: builder.mutation<
      Hotel,
      { id: string; display_order: number | null }
    >({
      query: ({ id, display_order }) => ({
        url: `/hotels/${id}/display-order`,
        method: "PUT",
        body: { display_order },
      }),
      invalidatesTags: [{ type: "Hotel", id: "LIST" }],
    }),

    /**
     * Restore a soft-deleted hotel.
     *
     * Brings back a previously deleted hotel and re-adds it to lists.
     */
    restoreHotel: builder.mutation<Hotel, string>({
      query: (id) => ({
        url: `/hotels/${id}/restore`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (result, _error, id) => [
        { type: "Hotel", id },
        { type: "Hotel", id: result?.slug || id },
        { type: "Hotel", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    // ─── Branch Mutations ────────────────────────────────────────────

    /**
     * Add a new branch to a hotel.
     *
     * Invalidates the hotel's branch list cache.
     */
    addHotelBranch: builder.mutation<
      HotelBranch,
      { hotelId: string; data: CreateBranchInput }
    >({
      query: ({ hotelId, data }) => ({
        url: `/hotels/${hotelId}/branches`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { hotelId }) => [
        { type: "Hotel", id: `${hotelId}-branches` },
        { type: "Hotel", id: hotelId },
      ],
    }),

    /**
     * Update an existing hotel branch.
     *
     * Invalidates the hotel's branch list and the specific hotel cache.
     */
    updateHotelBranch: builder.mutation<
      HotelBranch,
      {
        hotelId: string;
        branchId: string;
        data: Partial<CreateBranchInput>;
      }
    >({
      query: ({ hotelId, branchId, data }) => ({
        url: `/hotels/${hotelId}/branches/${branchId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { hotelId }) => [
        { type: "Hotel", id: `${hotelId}-branches` },
        { type: "Hotel", id: hotelId },
      ],
    }),

    /**
     * Remove a branch from a hotel.
     *
     * Invalidates the hotel's branch list and the specific hotel cache.
     */
    removeHotelBranch: builder.mutation<
      void,
      { hotelId: string; branchId: string }
    >({
      query: ({ hotelId, branchId }) => ({
        url: `/hotels/${hotelId}/branches/${branchId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { hotelId }) => [
        { type: "Hotel", id: `${hotelId}-branches` },
        { type: "Hotel", id: hotelId },
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
//     useListHotelsQuery,
//     useGetHotelBySlugQuery,
//     useGetHotelByIdQuery,
//     useGetHotelBranchesQuery,
//     useCreateHotelMutation,
//     useUpdateHotelMutation,
//     useDeleteHotelMutation,
//     usePublishHotelMutation,
//     useUpdateHotelDisplayOrderMutation,
//     useRestoreHotelMutation,
//     useAddHotelBranchMutation,
//     useUpdateHotelBranchMutation,
//     useRemoveHotelBranchMutation,
//   } from "@/lib/store/api/hotelsApi";
//
//   // List hotels with filters
//   const { data, isLoading } = useListHotelsQuery({
//     page: 1,
//     limit: 20,
//     status: "published",
//   });
//
//   // Get a single hotel by slug
//   const { data: hotel } = useGetHotelBySlugQuery("hotel-yak-and-yeti");
//
//   // Get hotel branches
//   const { data: branches } = useGetHotelBranchesQuery(hotelId);
//
//   // Create a new hotel
//   const [createHotel, { isLoading: creating }] = useCreateHotelMutation();
//   await createHotel({ name: "Hotel Annapurna", star_rating: 5 }).unwrap();
//
//   // Publish a hotel
//   const [publishHotel] = usePublishHotelMutation();
//   await publishHotel(hotelId).unwrap();
//
//   // Add a branch
//   const [addBranch] = useAddHotelBranchMutation();
//   await addBranch({
//     hotelId,
//     data: { name: "Pokhara Branch", address: "Lakeside, Pokhara" },
//   }).unwrap();
//
//   // Remove a branch
//   const [removeBranch] = useRemoveHotelBranchMutation();
//   await removeBranch({ hotelId, branchId }).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListHotelsQuery,
  useGetHotelBySlugQuery,
  useGetHotelByIdQuery,
  useGetHotelBranchesQuery,
  useCreateHotelMutation,
  useUpdateHotelMutation,
  useDeleteHotelMutation,
  usePublishHotelMutation,
  useUpdateHotelDisplayOrderMutation,
  useRestoreHotelMutation,
  useAddHotelBranchMutation,
  useUpdateHotelBranchMutation,
  useRemoveHotelBranchMutation,
} = hotelsApi;
