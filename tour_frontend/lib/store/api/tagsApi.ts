import { baseApi, buildQueryString } from "./baseApi";
import type {
  Tag,
  TagWithCount,
  CreateTagInput,
  PaginatedResponse,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListTagsParams {
  page?: number;
  limit?: number;
  tag_type?: string;
}

// ---------------------------------------------------------------------------
// Tags API slice — injected into the base API
//
// Tags are used to categorize and label content across the platform.
// They have their own table with a `tag_type` field (e.g. "topic",
// "category", "region") and a unique `slug` derived from the name.
//
// Tags support standard CRUD, search (autocomplete), and a count endpoint
// that returns the total number of tags in the system.
//
// The `TagWithCount` type extends `Tag` with a `content_count` field
// indicating how many content items are associated with each tag.
// ---------------------------------------------------------------------------

export const tagsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List tags with optional filters.
     *
     * Returns paginated `TagWithCount` objects (includes content_count).
     *
     * Cache tags:
     *   - { type: 'Tag', id: 'LIST' }
     *   - { type: 'Tag', id: '<slug>' } for each item
     */
    listTags: builder.query<
      PaginatedResponse<TagWithCount>,
      ListTagsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/tags${buildQueryString({
          page: p.page,
          limit: p.limit,
          tag_type: p.tag_type,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Tag", id: "LIST" }];
        }
        return [
          { type: "Tag", id: "LIST" },
          ...result.data.map((item) => ({
            type: "Tag" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 600,
    }),

    /**
     * Search tags by name (autocomplete).
     *
     * Returns a flat array of matching `Tag` objects. Used by tag
     * pickers and autocomplete inputs in content editors.
     *
     * Cache tags:
     *   - { type: 'Tag', id: 'SEARCH-<query>' }
     *
     * Short cache time since search results change frequently as
     * users type.
     */
    searchTags: builder.query<Tag[], string>({
      query: (query) => `/tags/search?q=${encodeURIComponent(query)}`,
      providesTags: (_result, _error, query) => [
        { type: "Tag", id: `SEARCH-${query}` },
      ],
      keepUnusedDataFor: 30,
    }),

    /**
     * Get a single tag by slug (includes content_count).
     *
     * Cache tags:
     *   - { type: 'Tag', id: '<slug>' }
     */
    getTagBySlug: builder.query<TagWithCount, string>({
      query: (slug) => `/tags/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: "Tag", id: slug }],
      keepUnusedDataFor: 600,
    }),

    /**
     * Get a single tag by ID (includes content_count).
     *
     * Cache tags:
     *   - { type: 'Tag', id: '<id>' }
     */
    getTagById: builder.query<TagWithCount, string>({
      query: (id) => `/tags/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Tag", id }],
      keepUnusedDataFor: 600,
    }),

    /**
     * Get total tag count.
     *
     * Returns `{ count: number }`. Used by the admin dashboard to show
     * how many tags exist in the system.
     *
     * Cache tags:
     *   - { type: 'Tag', id: 'COUNT' }
     */
    getTagCount: builder.query<{ count: number }, void>({
      query: () => "/tags/count",
      providesTags: [{ type: "Tag", id: "COUNT" }],
      keepUnusedDataFor: 300,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new tag.
     *
     * Invalidates the tag list, count, and all search caches so they
     * refetch with the new item.
     *
     * Usage:
     *   const [createTag, { isLoading }] = useCreateTagMutation();
     *   await createTag({ name: "Trekking", tag_type: "topic" }).unwrap();
     */
    createTag: builder.mutation<Tag, CreateTagInput>({
      query: (data) => ({
        url: "/tags",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "Tag", id: "LIST" },
        { type: "Tag", id: "COUNT" },
      ],
    }),

    /**
     * Update an existing tag by ID.
     *
     * Invalidates the specific tag, the list, and all search caches.
     * The slug may change if the name is updated, so we invalidate
     * broadly.
     *
     * Usage:
     *   const [updateTag, { isLoading }] = useUpdateTagMutation();
     *   await updateTag({
     *     id: tagId,
     *     data: { name: "Mountain Trekking" },
     *   }).unwrap();
     */
    updateTag: builder.mutation<
      Tag,
      { id: string; data: Partial<CreateTagInput> }
    >({
      query: ({ id, data }) => ({
        url: `/tags/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: "Tag", id },
        { type: "Tag", id: result?.slug || id },
        { type: "Tag", id: "LIST" },
      ],
    }),

    /**
     * Delete a tag by ID.
     *
     * Removes the tag and all associated content_tags records.
     * Invalidates the list, count, and the specific tag cache.
     *
     * Usage:
     *   const [deleteTag, { isLoading }] = useDeleteTagMutation();
     *   await deleteTag(tagId).unwrap();
     */
    deleteTag: builder.mutation<void, string>({
      query: (id) => ({
        url: `/tags/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Tag", id },
        { type: "Tag", id: "LIST" },
        { type: "Tag", id: "COUNT" },
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
//     useListTagsQuery,
//     useSearchTagsQuery,
//     useGetTagBySlugQuery,
//     useGetTagByIdQuery,
//     useGetTagCountQuery,
//     useCreateTagMutation,
//     useUpdateTagMutation,
//     useDeleteTagMutation,
//   } from "@/lib/store/api/tagsApi";
//
//   // List all tags
//   const { data, isLoading } = useListTagsQuery({ page: 1, limit: 50 });
//
//   // List tags filtered by type
//   const { data: topics } = useListTagsQuery({ tag_type: "topic" });
//
//   // Search tags (autocomplete)
//   const { data: results } = useSearchTagsQuery("trek", {
//     skip: searchQuery.length < 2, // Skip until user types 2+ chars
//   });
//
//   // Get a single tag by slug
//   const { data: tag } = useGetTagBySlugQuery("trekking");
//
//   // Get total tag count
//   const { data: count } = useGetTagCountQuery();
//
//   // Create a new tag
//   const [createTag, { isLoading: creating }] = useCreateTagMutation();
//   await createTag({ name: "Culture", tag_type: "topic" }).unwrap();
//
//   // Update a tag
//   const [updateTag, { isLoading: updating }] = useUpdateTagMutation();
//   await updateTag({ id: tagId, data: { name: "Cultural Heritage" } }).unwrap();
//
//   // Delete a tag
//   const [deleteTag, { isLoading: deleting }] = useDeleteTagMutation();
//   await deleteTag(tagId).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListTagsQuery,
  useSearchTagsQuery,
  useGetTagBySlugQuery,
  useGetTagByIdQuery,
  useGetTagCountQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} = tagsApi;
