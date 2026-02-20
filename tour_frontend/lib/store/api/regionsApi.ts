import { baseApi, buildQueryString } from "./baseApi";
import type { Region, PaginatedResponse, Post } from "@/lib/api-client";
import { enrichPaginated, type PostRaw } from "./postsApi";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListRegionsParams {
  page?: number;
  limit?: number;
  status?: string;
  province?: string;
}

export interface RegionAttractionsParams {
  slug: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Regions API slice — injected into the base API
//
// Regions represent geographical areas of Nepal (e.g. "Kathmandu Valley",
// "Annapurna Region"). Each region can have associated attractions, events,
// and other content linked via `region_id`.
//
// Regions are their own table (not posts), so they have their own CRUD
// endpoints under `/regions`.
// ---------------------------------------------------------------------------

export const regionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List regions with optional filters.
     *
     * Cache tags:
     *   - { type: 'Region', id: 'LIST' }
     *   - { type: 'Region', id: '<slug>' } for each item
     */
    listRegions: builder.query<
      PaginatedResponse<Region>,
      ListRegionsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/regions${buildQueryString({
          page: p.page,
          limit: p.limit,
          status: p.status,
          province: p.province,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Region", id: "LIST" }];
        }
        return [
          { type: "Region", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Region" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 3600,
    }),

    /**
     * Get a single region by slug.
     *
     * Cache tags:
     *   - { type: 'Region', id: '<slug>' }
     */
    getRegionBySlug: builder.query<Region, string>({
      query: (slug) => `/regions/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: "Region", id: slug }],
      keepUnusedDataFor: 3600,
    }),

    /**
     * Get attractions belonging to a specific region.
     *
     * Returns a paginated list of enriched Post objects (type='explore')
     * that are associated with the given region.
     *
     * Cache tags:
     *   - { type: 'Region', id: '<slug>-attractions' }
     *   - { type: 'Attraction', id: '<slug>' } for each attraction
     */
    getRegionAttractions: builder.query<
      PaginatedResponse<Post>,
      RegionAttractionsParams
    >({
      query: ({ slug, page, limit }) =>
        `/regions/${slug}/attractions${buildQueryString({
          page,
          limit,
        })}`,
      transformResponse: (response: PaginatedResponse<PostRaw>) =>
        enrichPaginated(response),
      providesTags: (result, _error, { slug }) => {
        const tags: Array<
          { type: "Region"; id: string } | { type: "Attraction"; id: string }
        > = [{ type: "Region", id: `${slug}-attractions` }];

        if (result?.data) {
          for (const item of result.data) {
            tags.push({
              type: "Attraction",
              id: item.slug || item.id,
            });
          }
        }

        return tags;
      },
      keepUnusedDataFor: 300,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new region.
     *
     * Invalidates the region list so it refetches with the new item.
     */
    createRegion: builder.mutation<
      Region,
      {
        name: string;
        description?: string | null;
        cover_image?: string | null;
        province?: string | null;
        district?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        is_featured?: boolean;
      }
    >({
      query: (data) => ({
        url: "/regions",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "Region", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an existing region by slug.
     *
     * Invalidates both the specific region and the list
     * (name/status/featured may change).
     */
    updateRegion: builder.mutation<
      Region,
      {
        slug: string;
        data: {
          name?: string;
          description?: string | null;
          cover_image?: string | null;
          province?: string | null;
          district?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_featured?: boolean;
          status?: string;
          attraction_rank?: number | null;
        };
      }
    >({
      query: ({ slug, data }) => ({
        url: `/regions/${slug}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { slug }) => [
        { type: "Region", id: slug },
        { type: "Region", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Delete a region by slug.
     *
     * Invalidates the list and removes the specific cache entry.
     */
    deleteRegion: builder.mutation<void, string>({
      query: (slug) => ({
        url: `/regions/${slug}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Region", id: slug },
        { type: "Region", id: "LIST" },
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
//     useListRegionsQuery,
//     useGetRegionBySlugQuery,
//     useGetRegionAttractionsQuery,
//     useCreateRegionMutation,
//     useUpdateRegionMutation,
//     useDeleteRegionMutation,
//   } from "@/lib/store/api/regionsApi";
//
//   // List all regions
//   const { data, isLoading } = useListRegionsQuery({ page: 1, limit: 20 });
//
//   // List regions filtered by province
//   const { data: bagmati } = useListRegionsQuery({ province: "Bagmati" });
//
//   // Get a single region by slug
//   const { data: region } = useGetRegionBySlugQuery("kathmandu-valley");
//
//   // Get attractions in a region
//   const { data: attractions } = useGetRegionAttractionsQuery({
//     slug: "kathmandu-valley",
//     page: 1,
//     limit: 10,
//   });
//
//   // Create a new region
//   const [createRegion, { isLoading: creating }] = useCreateRegionMutation();
//   await createRegion({ name: "Mustang", province: "Gandaki" }).unwrap();
//
//   // Update a region
//   const [updateRegion] = useUpdateRegionMutation();
//   await updateRegion({
//     slug: "mustang",
//     data: { is_featured: true },
//   }).unwrap();
//
//   // Delete a region
//   const [deleteRegion, { isLoading: deleting }] = useDeleteRegionMutation();
//   await deleteRegion("mustang").unwrap();
// ---------------------------------------------------------------------------

export const {
  useListRegionsQuery,
  useGetRegionBySlugQuery,
  useGetRegionAttractionsQuery,
  useCreateRegionMutation,
  useUpdateRegionMutation,
  useDeleteRegionMutation,
} = regionsApi;
