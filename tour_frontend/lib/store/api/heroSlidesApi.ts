import { baseApi } from "./baseApi";
import type {
  HeroSlide,
  ResolvedHeroSlide,
  CreateHeroSlideInput,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Hero Slides API slice — injected into the base API
//
// Hero slides are displayed on the homepage carousel. Each slide can either
// reference existing content (post, event, attraction, etc.) or have
// custom content (title, subtitle, image, link).
//
// The backend provides two views:
//   - Public: GET /hero-slides → resolved slides with content data merged in
//   - Admin:  GET /hero-slides/admin → raw slides for management
//
// Slides support toggling active/inactive, reordering, and standard CRUD.
// ---------------------------------------------------------------------------

export const heroSlidesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List resolved hero slides for the public homepage.
     *
     * Returns slides with content data merged in (title, subtitle, image,
     * link are resolved from the referenced content item). Only active
     * slides are returned, sorted by display_order.
     *
     * Cache tags:
     *   - { type: 'HeroSlide', id: 'PUBLIC' }
     */
    listHeroSlides: builder.query<ResolvedHeroSlide[], void>({
      query: () => "/hero-slides",
      providesTags: (result) => {
        if (!result) {
          return [{ type: "HeroSlide", id: "PUBLIC" }];
        }
        return [
          { type: "HeroSlide", id: "PUBLIC" },
          ...result.map((item) => ({
            type: "HeroSlide" as const,
            id: item.id,
          })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * List all hero slides for admin management.
     *
     * Returns raw slides (not resolved) including inactive ones.
     * Sorted by display_order.
     *
     * Cache tags:
     *   - { type: 'HeroSlide', id: 'ADMIN' }
     *   - { type: 'HeroSlide', id: '<id>' } for each item
     */
    listAllHeroSlides: builder.query<HeroSlide[], void>({
      query: () => "/hero-slides/admin",
      providesTags: (result) => {
        if (!result) {
          return [{ type: "HeroSlide", id: "ADMIN" }];
        }
        return [
          { type: "HeroSlide", id: "ADMIN" },
          ...result.map((item) => ({
            type: "HeroSlide" as const,
            id: item.id,
          })),
        ];
      },
      keepUnusedDataFor: 120,
    }),

    /**
     * Get hero slide counts (total, active, inactive).
     *
     * Cache tags:
     *   - { type: 'HeroSlide', id: 'COUNTS' }
     */
    getHeroSlideCounts: builder.query<
      { total: number; active: number; inactive: number },
      void
    >({
      query: () => "/hero-slides/admin/counts",
      providesTags: [{ type: "HeroSlide", id: "COUNTS" }],
      keepUnusedDataFor: 60,
    }),

    /**
     * Get a single hero slide by ID.
     *
     * Cache tags:
     *   - { type: 'HeroSlide', id: '<id>' }
     */
    getHeroSlideById: builder.query<HeroSlide, string>({
      query: (id) => `/hero-slides/${id}`,
      providesTags: (_result, _error, id) => [{ type: "HeroSlide", id }],
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new hero slide.
     *
     * Invalidates admin list, public list, and counts.
     */
    createHeroSlide: builder.mutation<HeroSlide, CreateHeroSlideInput>({
      query: (data) => ({
        url: "/hero-slides",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "HeroSlide", id: "ADMIN" },
        { type: "HeroSlide", id: "PUBLIC" },
        { type: "HeroSlide", id: "COUNTS" },
      ],
    }),

    /**
     * Update an existing hero slide by ID.
     *
     * Invalidates the specific slide, admin list, public list, and counts
     * (active status or content reference may change).
     */
    updateHeroSlide: builder.mutation<
      HeroSlide,
      { id: string; data: Partial<CreateHeroSlideInput> }
    >({
      query: ({ id, data }) => ({
        url: `/hero-slides/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "HeroSlide", id },
        { type: "HeroSlide", id: "ADMIN" },
        { type: "HeroSlide", id: "PUBLIC" },
        { type: "HeroSlide", id: "COUNTS" },
      ],
    }),

    /**
     * Delete a hero slide by ID.
     *
     * Invalidates all hero slide caches.
     */
    deleteHeroSlide: builder.mutation<void, string>({
      query: (id) => ({
        url: `/hero-slides/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "HeroSlide", id },
        { type: "HeroSlide", id: "ADMIN" },
        { type: "HeroSlide", id: "PUBLIC" },
        { type: "HeroSlide", id: "COUNTS" },
      ],
    }),

    /**
     * Toggle a hero slide's active/inactive status.
     *
     * Uses POST /hero-slides/:id/toggle. The backend flips the
     * `is_active` boolean and returns the updated slide.
     *
     * Invalidates all hero slide caches since the public list
     * (active-only) and counts both change.
     */
    toggleHeroSlideActive: builder.mutation<HeroSlide, string>({
      query: (id) => ({
        url: `/hero-slides/${id}/toggle`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "HeroSlide", id },
        { type: "HeroSlide", id: "ADMIN" },
        { type: "HeroSlide", id: "PUBLIC" },
        { type: "HeroSlide", id: "COUNTS" },
      ],
    }),

    /**
     * Reorder hero slides.
     *
     * Accepts an array of `{ id, sort_order }` objects defining the new
     * display order for all slides. Invalidates both admin and public
     * lists since the order affects both views.
     *
     * Usage:
     *   await reorderHeroSlides([
     *     { id: "slide-1", sort_order: 0 },
     *     { id: "slide-2", sort_order: 1 },
     *     { id: "slide-3", sort_order: 2 },
     *   ]).unwrap();
     */
    reorderHeroSlides: builder.mutation<
      void,
      { id: string; sort_order: number }[]
    >({
      query: (orders) => ({
        url: "/hero-slides/admin/reorder",
        method: "PUT",
        body: { orders },
      }),
      invalidatesTags: [
        { type: "HeroSlide", id: "ADMIN" },
        { type: "HeroSlide", id: "PUBLIC" },
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
//     useListHeroSlidesQuery,
//     useListAllHeroSlidesQuery,
//     useGetHeroSlideCountsQuery,
//     useGetHeroSlideByIdQuery,
//     useCreateHeroSlideMutation,
//     useUpdateHeroSlideMutation,
//     useDeleteHeroSlideMutation,
//     useToggleHeroSlideActiveMutation,
//     useReorderHeroSlidesMutation,
//   } from "@/lib/store/api/heroSlidesApi";
//
//   // Public: get resolved slides for homepage carousel
//   const { data: slides, isLoading } = useListHeroSlidesQuery();
//
//   // Admin: get all slides for management
//   const { data: allSlides } = useListAllHeroSlidesQuery();
//
//   // Get counts (total, active, inactive)
//   const { data: counts } = useGetHeroSlideCountsQuery();
//
//   // Toggle a slide active/inactive
//   const [toggleActive, { isLoading: toggling }] =
//     useToggleHeroSlideActiveMutation();
//   await toggleActive(slideId).unwrap();
//
//   // Reorder slides
//   const [reorder] = useReorderHeroSlidesMutation();
//   await reorder([
//     { id: "slide-1", sort_order: 0 },
//     { id: "slide-2", sort_order: 1 },
//   ]).unwrap();
//
//   // Create a new slide
//   const [createSlide, { isLoading: creating }] =
//     useCreateHeroSlideMutation();
//   await createSlide({
//     content_type: "post",
//     content_id: "some-post-uuid",
//     is_active: true,
//   }).unwrap();
//
//   // Delete a slide
//   const [deleteSlide, { isLoading: deleting }] =
//     useDeleteHeroSlideMutation();
//   await deleteSlide(slideId).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListHeroSlidesQuery,
  useListAllHeroSlidesQuery,
  useGetHeroSlideCountsQuery,
  useGetHeroSlideByIdQuery,
  useCreateHeroSlideMutation,
  useUpdateHeroSlideMutation,
  useDeleteHeroSlideMutation,
  useToggleHeroSlideActiveMutation,
  useReorderHeroSlidesMutation,
} = heroSlidesApi;
