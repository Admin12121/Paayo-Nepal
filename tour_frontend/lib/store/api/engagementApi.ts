import { baseApi } from "./baseApi";
import type { ViewStats, LikeStatus } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Engagement API slice — injected into the base API
//
// Handles view tracking and like toggling for content items. These are
// public-facing engagement endpoints that are rate-limited per-device
// (using X-Device-Id header or IP+UA fallback).
//
// View recording:
//   POST /views  →  records a view for a content item
//   GET  /views/:target_type/:target_id  →  get view stats
//
// Like toggling:
//   POST /content/:target_type/:target_id/like  →  toggle like on/off
//   GET  /content/:target_type/:target_id/like-status  →  get like status
//
// Both views and likes use deduplication on the backend (viewer_hash)
// so the same user/device can't inflate counts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

export interface RecordViewParams {
  target_type: string;
  target_id: string;
}

export interface ViewStatsParams {
  target_type: string;
  target_id: string;
}

export interface LikeParams {
  target_type: string;
  target_id: string;
}

// ---------------------------------------------------------------------------
// Engagement API endpoints
// ---------------------------------------------------------------------------

export const engagementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Views ────────────────────────────────────────────────────────

    /**
     * Record a page/content view.
     *
     * Should be called once per page mount (after a short delay to avoid
     * counting bot prefetches). The `useViewTracker` hook handles this
     * automatically.
     *
     * The backend deduplicates views using a viewer_hash
     * (SHA-256 of context + IP + User-Agent + salt), so calling this
     * multiple times for the same content won't inflate view counts.
     *
     * Does NOT invalidate any cache tags — view counts are informational
     * and don't need to trigger refetches of content lists. The dashboard
     * stats will pick up new counts on their next refetch cycle.
     *
     * Usage:
     *   const [recordView] = useRecordViewMutation();
     *   recordView({ target_type: "post", target_id: postId });
     *   // Fire-and-forget — don't await, don't care about result
     */
    recordView: builder.mutation<{ success: boolean }, RecordViewParams>({
      query: ({ target_type, target_id }) => ({
        url: "/views",
        method: "POST",
        body: { target_type, target_id },
      }),
      // Views are fire-and-forget — no cache invalidation needed.
      // Dashboard stats will refetch on their own schedule.
    }),

    /**
     * Get view statistics for a specific content item.
     *
     * Returns total views and unique viewer count.
     *
     * Cache tags:
     *   - { type: 'ViewStats', id: '<target_type>-<target_id>' }
     *
     * Usage:
     *   const { data: stats } = useGetViewStatsQuery({
     *     target_type: "post",
     *     target_id: postId,
     *   });
     *   // stats.total_views, stats.unique_viewers
     */
    getViewStats: builder.query<ViewStats, ViewStatsParams>({
      query: ({ target_type, target_id }) =>
        `/views/${target_type}/${target_id}`,
      providesTags: (_result, _error, { target_type, target_id }) => [
        { type: "ViewStats", id: `${target_type}-${target_id}` },
      ],
      keepUnusedDataFor: 120,
    }),

    // ─── Likes ────────────────────────────────────────────────────────

    /**
     * Toggle like status for a content item.
     *
     * If the user has already liked the item, this removes the like.
     * If not, it adds a like. Returns the new like status and count.
     *
     * Requires authentication (the backend identifies the user from the
     * session cookie). Guest users cannot like content.
     *
     * Invalidates the like status cache for this specific content item
     * so the UI immediately reflects the new state.
     *
     * Usage:
     *   const [toggleLike, { isLoading }] = useToggleLikeMutation();
     *
     *   const handleLike = async () => {
     *     try {
     *       const result = await toggleLike({
     *         target_type: "post",
     *         target_id: postId,
     *       }).unwrap();
     *       // result.liked === true/false
     *       // result.like_count === new total
     *     } catch (err) {
     *       // 401 if not authenticated
     *     }
     *   };
     */
    toggleLike: builder.mutation<LikeStatus, LikeParams>({
      query: ({ target_type, target_id }) => ({
        url: `/content/${target_type}/${target_id}/like`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, { target_type, target_id }) => [
        { type: "LikeStatus", id: `${target_type}-${target_id}` },
      ],
      // Optimistic update: immediately toggle the UI before the server
      // responds. If the server request fails, RTK Query will automatically
      // revert to the previous state.
      async onQueryStarted({ target_type, target_id }, { dispatch, queryFulfilled }) {
        // Optimistically update the like status cache
        const patchResult = dispatch(
          engagementApi.util.updateQueryData(
            "getLikeStatus",
            { target_type, target_id },
            (draft) => {
              draft.liked = !draft.liked;
              draft.like_count += draft.liked ? 1 : -1;
            },
          ),
        );

        try {
          await queryFulfilled;
        } catch {
          // Revert the optimistic update if the server request failed
          patchResult.undo();
        }
      },
    }),

    /**
     * Get like status for a content item.
     *
     * Returns whether the current user has liked the item and the total
     * like count.
     *
     * If the user is not authenticated, `liked` will be `false` and
     * `like_count` will still reflect the total number of likes.
     *
     * Cache tags:
     *   - { type: 'LikeStatus', id: '<target_type>-<target_id>' }
     *
     * Usage:
     *   const { data: likeStatus } = useGetLikeStatusQuery({
     *     target_type: "post",
     *     target_id: postId,
     *   });
     *   // likeStatus.liked === true/false
     *   // likeStatus.like_count === total likes
     */
    getLikeStatus: builder.query<LikeStatus, LikeParams>({
      query: ({ target_type, target_id }) =>
        `/content/${target_type}/${target_id}/like-status`,
      providesTags: (_result, _error, { target_type, target_id }) => [
        { type: "LikeStatus", id: `${target_type}-${target_id}` },
      ],
      keepUnusedDataFor: 120,
    }),
  }),

  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks
//
// Usage:
//   import {
//     useRecordViewMutation,
//     useGetViewStatsQuery,
//     useToggleLikeMutation,
//     useGetLikeStatusQuery,
//   } from "@/lib/store/api/engagementApi";
//
//   // ── View tracking ──
//   // Typically used via the useViewTracker hook, but can also be called
//   // directly for custom tracking needs.
//   const [recordView] = useRecordViewMutation();
//   // Fire-and-forget — don't await
//   recordView({ target_type: "post", target_id: postId });
//
//   // ── View stats ──
//   const { data: stats } = useGetViewStatsQuery({
//     target_type: "post",
//     target_id: postId,
//   });
//   console.log(`${stats?.total_views} views, ${stats?.unique_viewers} unique`);
//
//   // ── Like toggle ──
//   // With optimistic updates — the UI toggles immediately, and reverts
//   // if the server request fails.
//   const [toggleLike, { isLoading: liking }] = useToggleLikeMutation();
//   const handleLike = () => {
//     toggleLike({ target_type: "post", target_id: postId });
//   };
//
//   // ── Like status ──
//   const { data: likeStatus } = useGetLikeStatusQuery({
//     target_type: "post",
//     target_id: postId,
//   });
//   const isLiked = likeStatus?.liked ?? false;
//   const likeCount = likeStatus?.like_count ?? 0;
// ---------------------------------------------------------------------------

export const {
  useRecordViewMutation,
  useGetViewStatsQuery,
  useToggleLikeMutation,
  useGetLikeStatusQuery,
} = engagementApi;
