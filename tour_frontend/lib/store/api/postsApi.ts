import { baseApi, buildQueryString, provideListTags } from "./baseApi";
import type {
  Post,
  PostEnriched,
  PaginatedResponse,
  CreatePostInput,
  OpeningHours,
} from "@/lib/api-client";
// Re-export PostRaw so feature slices (events, attractions, activities) can
// import it without depending on the monolithic api-client.
export type { PostRaw } from "@/lib/api-client";
import type { PostRaw } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Post enrichment — mirrors the logic in api-client.ts
//
// The backend stores type-specific metadata in the JSONB `content` column.
// Frontend pages reference those as top-level fields (e.g. `post.rating`,
// `post.location`). This function flattens the JSONB into the object.
//
// These functions are exported so that other feature slices (events,
// attractions, activities) can reuse the same enrichment logic — all of
// those content types are stored in the `posts` table.
// ---------------------------------------------------------------------------

export function enrichPost<T extends PostRaw>(raw: T): T & PostEnriched {
  const contentObj: Record<string, unknown> =
    raw.content !== null &&
    typeof raw.content === "object" &&
    !Array.isArray(raw.content)
      ? (raw.content as Record<string, unknown>)
      : {};

  return {
    ...contentObj,
    ...raw,
    post_type: raw.type,
    views: raw.view_count ?? 0,
    likes: raw.like_count ?? 0,
    description:
      raw.short_description ??
      (contentObj.description as string | null) ??
      null,
    start_time:
      (contentObj.start_time as string | null) ?? raw.event_date ?? null,
    end_time:
      (contentObj.end_time as string | null) ?? raw.event_end_date ?? null,
    location: (contentObj.location as string | null) ?? null,
    rating: (contentObj.rating as number | null) ?? null,
    review_count: (contentObj.review_count as number) ?? 0,
    address: (contentObj.address as string | null) ?? null,
    entry_fee: (contentObj.entry_fee as string | null) ?? null,
    latitude: (contentObj.latitude as number | null) ?? null,
    longitude: (contentObj.longitude as number | null) ?? null,
    opening_hours: (contentObj.opening_hours as OpeningHours | null) ?? null,
    icon: (contentObj.icon as string | null) ?? null,
    is_active: raw.status === "published",
    tags: (contentObj.tags as string[]) ?? [],
    meta_title: (contentObj.meta_title as string | null) ?? null,
    meta_description: (contentObj.meta_description as string | null) ?? null,
  } as T & PostEnriched;
}

export function enrichPaginated(
  resp: PaginatedResponse<PostRaw>,
): PaginatedResponse<Post> {
  return {
    ...resp,
    data: resp.data.map(enrichPost),
  };
}

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListPostsParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  sort_by?: string;
  is_featured?: boolean;
}

// ---------------------------------------------------------------------------
// Posts API slice — injected into the base API
// ---------------------------------------------------------------------------

export const postsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List posts with optional filters.
     *
     * Cache tags:
     *   - { type: 'Post', id: 'LIST' }           → invalidated on create/delete
     *   - { type: 'Post', id: '<slug>' }          → invalidated on update
     */
    listPosts: builder.query<PaginatedResponse<Post>, ListPostsParams | void>({
      query: (params) => {
        const p = params ?? {};
        return `/posts${buildQueryString({
          page: p.page,
          limit: p.limit,
          status: p.status,
          post_type: p.type,
          sort_by: p.sort_by,
          is_featured: p.is_featured,
        })}`;
      },
      transformResponse: (response: PaginatedResponse<PostRaw>) =>
        enrichPaginated(response),
      providesTags: provideListTags<Post, "Post">("Post"),
      keepUnusedDataFor: 60,
    }),

    /**
     * Get a single post by slug.
     *
     * Cache tags:
     *   - { type: 'Post', id: '<slug>' }
     */
    getPostBySlug: builder.query<Post, string>({
      query: (slug) => `/posts/${slug}`,
      transformResponse: (response: PostRaw) => enrichPost(response),
      providesTags: (_result, _error, slug) => [{ type: "Post", id: slug }],
      keepUnusedDataFor: 60,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Create a new post.
     * Invalidates the post list so it refetches with the new item.
     */
    createPost: builder.mutation<Post, CreatePostInput>({
      query: (data) => ({
        url: "/posts",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [
        { type: "Post", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update an existing post by slug.
     * Invalidates both the specific post and the list (status/title may change).
     */
    updatePost: builder.mutation<
      Post,
      { slug: string; data: Partial<CreatePostInput> }
    >({
      query: ({ slug, data }) => ({
        url: `/posts/${slug}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: (_result, _error, { slug }) => [
        { type: "Post", id: slug },
        { type: "Post", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Delete a post by slug.
     * Invalidates the list and removes the specific cache entry.
     */
    deletePost: builder.mutation<void, string>({
      query: (slug) => ({
        url: `/posts/${slug}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Post", id: slug },
        { type: "Post", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Publish a post (draft → published).
     */
    publishPost: builder.mutation<Post, string>({
      query: (id) => ({
        url: `/posts/${id}/publish`,
        method: "POST",
        body: {},
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [
        { type: "Post", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Approve a pending post (admin action).
     */
    approvePost: builder.mutation<Post, string>({
      query: (id) => ({
        url: `/posts/${id}/approve`,
        method: "POST",
        body: {},
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [
        { type: "Post", id: "LIST" },
        { type: "DashboardStats" },
      ],
    }),

    /**
     * Update a post's featured status.
     */
    updatePostFeatured: builder.mutation<
      Post,
      { id: string; is_featured: boolean }
    >({
      query: ({ id, is_featured }) => ({
        url: `/posts/${id}/featured`,
        method: "PUT",
        body: { is_featured },
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [{ type: "Post", id: "LIST" }],
    }),

    /**
     * Update a post's display order.
     */
    updatePostDisplayOrder: builder.mutation<
      Post,
      { id: string; display_order: number | null }
    >({
      query: ({ id, display_order }) => ({
        url: `/posts/${id}/display-order`,
        method: "PUT",
        body: { display_order },
      }),
      transformResponse: (response: PostRaw) => enrichPost(response),
      invalidatesTags: [{ type: "Post", id: "LIST" }],
    }),
  }),

  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks
//
// These hooks are the primary way dashboard pages interact with the posts API.
//
// Usage:
//   import { useListPostsQuery, useDeletePostMutation } from "@/lib/store/api/postsApi";
//
//   const { data, isLoading, error } = useListPostsQuery({ page: 1, limit: 20 });
//   const [deletePost, { isLoading: deleting }] = useDeletePostMutation();
// ---------------------------------------------------------------------------

export const {
  useListPostsQuery,
  useGetPostBySlugQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  usePublishPostMutation,
  useApprovePostMutation,
  useUpdatePostFeaturedMutation,
  useUpdatePostDisplayOrderMutation,
} = postsApi;
