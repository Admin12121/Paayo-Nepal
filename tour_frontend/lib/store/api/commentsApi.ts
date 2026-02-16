import { baseApi, buildQueryString } from "./baseApi";
import type { Comment, PaginatedResponse } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListCommentsForPostParams {
  postId: string;
  page?: number;
  limit?: number;
}

export interface ListCommentsForContentParams {
  target_type: string;
  target_id: string;
  page?: number;
  limit?: number;
}

export interface ListCommentsForModerationParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface CreateCommentInput {
  target_type: string;
  target_id: string;
  guest_name: string;
  guest_email: string;
  content: string;
  parent_id?: string;
}

// ---------------------------------------------------------------------------
// Comments API slice — injected into the base API
//
// Comments are guest-submitted (no auth required to create) and attached to
// content items via `target_type` + `target_id`. They support a simple
// parent/child threading model via `parent_id`.
//
// Comments go through a moderation workflow:
//   pending → approved | rejected | spam
//
// Admin/editor endpoints for moderation are under `/comments/moderation/*`.
// Batch operations allow approving or deleting multiple comments at once.
//
// Public endpoints:
//   - GET  /comments/post/:postId     — list approved comments for a post
//   - GET  /comments?target_type=&target_id= — list approved comments for any content
//   - POST /comments                  — create a new comment (starts as pending)
//
// Admin endpoints:
//   - GET  /comments/moderation       — list comments by status (pending/approved/rejected/spam)
//   - GET  /comments/moderation/pending-count — get count of pending comments
//   - POST /comments/:id/approve      — approve a comment
//   - POST /comments/:id/reject       — reject a comment
//   - POST /comments/:id/spam         — mark a comment as spam
//   - POST /comments/batch/approve    — batch approve comments
//   - POST /comments/batch/delete     — batch delete comments
//   - PUT  /comments/:id              — update comment content
//   - DELETE /comments/:id            — delete a single comment
// ---------------------------------------------------------------------------

export const commentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Public Queries ───────────────────────────────────────────────

    /**
     * List approved comments for a specific post.
     *
     * Uses the `/comments/post/:postId` endpoint which returns only
     * approved comments, paginated.
     *
     * Cache tags:
     *   - { type: 'Comment', id: 'POST-<postId>' }
     *   - { type: 'Comment', id: '<id>' } for each comment
     */
    listCommentsForPost: builder.query<
      PaginatedResponse<Comment>,
      ListCommentsForPostParams
    >({
      query: ({ postId, page, limit }) =>
        `/comments/post/${postId}${buildQueryString({ page, limit })}`,
      providesTags: (result, _error, { postId }) => {
        if (!result?.data) {
          return [{ type: "Comment", id: `POST-${postId}` }];
        }
        return [
          { type: "Comment", id: `POST-${postId}` },
          ...result.data.map((item) => ({
            type: "Comment" as const,
            id: item.id,
          })),
        ];
      },
      keepUnusedDataFor: 60,
    }),

    /**
     * List approved comments for any content item by target_type + target_id.
     *
     * More flexible than `listCommentsForPost` — works with any content
     * type (video, photo, hotel, etc.).
     *
     * Cache tags:
     *   - { type: 'Comment', id: 'CONTENT-<target_type>-<target_id>' }
     *   - { type: 'Comment', id: '<id>' } for each comment
     */
    listCommentsForContent: builder.query<
      PaginatedResponse<Comment>,
      ListCommentsForContentParams
    >({
      query: ({ target_type, target_id, page, limit }) =>
        `/comments${buildQueryString({
          target_type,
          target_id,
          page,
          limit,
        })}`,
      providesTags: (result, _error, { target_type, target_id }) => {
        const listTag = `CONTENT-${target_type}-${target_id}`;
        if (!result?.data) {
          return [{ type: "Comment", id: listTag }];
        }
        return [
          { type: "Comment", id: listTag },
          ...result.data.map((item) => ({
            type: "Comment" as const,
            id: item.id,
          })),
        ];
      },
      keepUnusedDataFor: 60,
    }),

    // ─── Admin / Moderation Queries ───────────────────────────────────

    /**
     * List comments for moderation (admin/editor).
     *
     * Returns all comments regardless of status, with optional status
     * filter. Used by the comments management dashboard.
     *
     * Cache tags:
     *   - { type: 'Comment', id: 'MODERATION' }
     *   - { type: 'Comment', id: '<id>' } for each comment
     */
    listCommentsForModeration: builder.query<
      PaginatedResponse<Comment>,
      ListCommentsForModerationParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/comments/moderation${buildQueryString({
          page: p.page,
          limit: p.limit,
          status: p.status,
        })}`;
      },
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Comment", id: "MODERATION" }];
        }
        return [
          { type: "Comment", id: "MODERATION" },
          ...result.data.map((item) => ({
            type: "Comment" as const,
            id: item.id,
          })),
        ];
      },
      keepUnusedDataFor: 30,
    }),

    /**
     * Get count of pending comments awaiting moderation.
     *
     * Returns `{ count: number }`. Used by the admin dashboard to show
     * a badge count on the comments navigation item.
     *
     * Cache tags:
     *   - { type: 'Comment', id: 'PENDING_COUNT' }
     */
    getPendingCommentCount: builder.query<{ count: number }, void>({
      query: () => "/comments/moderation/pending-count",
      providesTags: [{ type: "Comment", id: "PENDING_COUNT" }],
      keepUnusedDataFor: 30,
    }),

    // ─── Public Mutations ─────────────────────────────────────────────

    /**
     * Create a new comment.
     *
     * Guest-submitted (no auth required). The comment starts in `pending`
     * status and must be approved by a moderator before it appears
     * publicly.
     *
     * Invalidates the pending count and moderation list so admins see
     * new comments immediately. Does NOT invalidate public comment lists
     * because the new comment is pending (not yet visible).
     *
     * Usage:
     *   const [createComment, { isLoading }] = useCreateCommentMutation();
     *   await createComment({
     *     target_type: "post",
     *     target_id: postId,
     *     guest_name: "Ram Bahadur",
     *     guest_email: "ram@example.com",
     *     content: "Great article!",
     *   }).unwrap();
     */
    createComment: builder.mutation<Comment, CreateCommentInput>({
      query: (data) => ({
        url: "/comments",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "Comment", id: "PENDING_COUNT" },
        { type: "Comment", id: "MODERATION" },
      ],
    }),

    /**
     * Update a comment's content.
     *
     * Only the comment author (by email match) or admin/editor can update.
     *
     * Invalidates the specific comment, the moderation list, and any
     * content-specific comment lists the comment belongs to.
     */
    updateComment: builder.mutation<
      Comment,
      { id: string; content: string }
    >({
      query: ({ id, content }) => ({
        url: `/comments/${id}`,
        method: "PUT",
        body: { content },
      }),
      invalidatesTags: (result, _error, { id }) => {
        const tags: Array<{ type: "Comment"; id: string }> = [
          { type: "Comment", id },
          { type: "Comment", id: "MODERATION" },
        ];
        // Also invalidate the content-specific comment list if we know
        // what content this comment belongs to.
        if (result) {
          tags.push({
            type: "Comment",
            id: `CONTENT-${result.target_type}-${result.target_id}`,
          });
          tags.push({
            type: "Comment",
            id: `POST-${result.target_id}`,
          });
        }
        return tags;
      },
    }),

    /**
     * Delete a single comment by ID.
     *
     * Permanently removes the comment. Invalidates the specific comment,
     * moderation list, pending count, and all related content lists.
     */
    deleteComment: builder.mutation<void, string>({
      query: (id) => ({
        url: `/comments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Comment", id },
        { type: "Comment", id: "MODERATION" },
        { type: "Comment", id: "PENDING_COUNT" },
        // We don't know which content list this comment was in, so we
        // can't do a targeted invalidation. The stale list will show one
        // extra item until it's refetched by other means (focus, nav).
        // This is acceptable since comment deletion is rare.
      ],
    }),

    // ─── Moderation Mutations ─────────────────────────────────────────

    /**
     * Approve a pending comment (makes it publicly visible).
     *
     * Changes the comment's status from `pending` to `approved`.
     * Invalidates the moderation list, pending count, and all related
     * content lists (the comment now appears publicly).
     */
    approveComment: builder.mutation<Comment, string>({
      query: (id) => ({
        url: `/comments/${id}/approve`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (result, _error, id) => {
        const tags: Array<{ type: "Comment"; id: string }> = [
          { type: "Comment", id },
          { type: "Comment", id: "MODERATION" },
          { type: "Comment", id: "PENDING_COUNT" },
        ];
        if (result) {
          tags.push({
            type: "Comment",
            id: `CONTENT-${result.target_type}-${result.target_id}`,
          });
          tags.push({
            type: "Comment",
            id: `POST-${result.target_id}`,
          });
        }
        return tags;
      },
    }),

    /**
     * Reject a comment (admin/editor moderation action).
     *
     * Changes the comment's status from `pending` to `rejected`.
     * The comment is no longer visible publicly.
     */
    rejectComment: builder.mutation<Comment, string>({
      query: (id) => ({
        url: `/comments/${id}/reject`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (result, _error, id) => {
        const tags: Array<{ type: "Comment"; id: string }> = [
          { type: "Comment", id },
          { type: "Comment", id: "MODERATION" },
          { type: "Comment", id: "PENDING_COUNT" },
        ];
        if (result) {
          tags.push({
            type: "Comment",
            id: `CONTENT-${result.target_type}-${result.target_id}`,
          });
          tags.push({
            type: "Comment",
            id: `POST-${result.target_id}`,
          });
        }
        return tags;
      },
    }),

    /**
     * Mark a comment as spam.
     *
     * Changes the comment's status from any state to `spam`.
     * The comment is no longer visible publicly.
     */
    markCommentSpam: builder.mutation<Comment, string>({
      query: (id) => ({
        url: `/comments/${id}/spam`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (result, _error, id) => {
        const tags: Array<{ type: "Comment"; id: string }> = [
          { type: "Comment", id },
          { type: "Comment", id: "MODERATION" },
          { type: "Comment", id: "PENDING_COUNT" },
        ];
        if (result) {
          tags.push({
            type: "Comment",
            id: `CONTENT-${result.target_type}-${result.target_id}`,
          });
          tags.push({
            type: "Comment",
            id: `POST-${result.target_id}`,
          });
        }
        return tags;
      },
    }),

    // ─── Batch Mutations ──────────────────────────────────────────────

    /**
     * Batch approve multiple comments.
     *
     * Accepts an array of comment IDs. Returns `{ approved: number }`
     * with the count of successfully approved comments.
     *
     * Invalidates all comment-related caches broadly since we don't
     * know which content lists are affected.
     *
     * Usage:
     *   const [batchApprove, { isLoading }] = useBatchApproveCommentsMutation();
     *   const result = await batchApprove(["id-1", "id-2", "id-3"]).unwrap();
     *   console.log(`Approved ${result.approved} comments`);
     */
    batchApproveComments: builder.mutation<{ approved: number }, string[]>({
      query: (ids) => ({
        url: "/comments/batch/approve",
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: [
        { type: "Comment", id: "MODERATION" },
        { type: "Comment", id: "PENDING_COUNT" },
      ],
    }),

    /**
     * Batch delete multiple comments.
     *
     * Accepts an array of comment IDs. Returns `{ deleted: number }`
     * with the count of successfully deleted comments.
     *
     * Invalidates all comment-related caches broadly since we don't
     * know which content lists are affected.
     *
     * Usage:
     *   const [batchDelete, { isLoading }] = useBatchDeleteCommentsMutation();
     *   const result = await batchDelete(["id-1", "id-2", "id-3"]).unwrap();
     *   console.log(`Deleted ${result.deleted} comments`);
     */
    batchDeleteComments: builder.mutation<{ deleted: number }, string[]>({
      query: (ids) => ({
        url: "/comments/batch/delete",
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: [
        { type: "Comment", id: "MODERATION" },
        { type: "Comment", id: "PENDING_COUNT" },
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
//     useListCommentsForPostQuery,
//     useListCommentsForContentQuery,
//     useListCommentsForModerationQuery,
//     useGetPendingCommentCountQuery,
//     useCreateCommentMutation,
//     useUpdateCommentMutation,
//     useDeleteCommentMutation,
//     useApproveCommentMutation,
//     useRejectCommentMutation,
//     useMarkCommentSpamMutation,
//     useBatchApproveCommentsMutation,
//     useBatchDeleteCommentsMutation,
//   } from "@/lib/store/api/commentsApi";
//
//   // List approved comments for a post (public)
//   const { data, isLoading } = useListCommentsForPostQuery({
//     postId: "some-post-id",
//     page: 1,
//     limit: 20,
//   });
//
//   // List approved comments for any content type
//   const { data: videoComments } = useListCommentsForContentQuery({
//     target_type: "video",
//     target_id: videoId,
//     page: 1,
//     limit: 20,
//   });
//
//   // Moderation: list comments by status
//   const { data: pending } = useListCommentsForModerationQuery({
//     status: "pending",
//     page: 1,
//     limit: 50,
//   });
//
//   // Get pending comment count (for badge)
//   const { data: pendingCount } = useGetPendingCommentCountQuery();
//
//   // Create a comment (guest-submitted)
//   const [createComment, { isLoading: creating }] = useCreateCommentMutation();
//   await createComment({
//     target_type: "post",
//     target_id: postId,
//     guest_name: "Sita Devi",
//     guest_email: "sita@example.com",
//     content: "Very informative article!",
//   }).unwrap();
//
//   // Moderate a comment
//   const [approve] = useApproveCommentMutation();
//   await approve(commentId).unwrap();
//
//   const [reject] = useRejectCommentMutation();
//   await reject(commentId).unwrap();
//
//   const [markSpam] = useMarkCommentSpamMutation();
//   await markSpam(commentId).unwrap();
//
//   // Batch operations
//   const [batchApprove] = useBatchApproveCommentsMutation();
//   await batchApprove(["id-1", "id-2"]).unwrap();
//
//   const [batchDelete] = useBatchDeleteCommentsMutation();
//   await batchDelete(["id-3", "id-4"]).unwrap();
// ---------------------------------------------------------------------------

export const {
  useListCommentsForPostQuery,
  useListCommentsForContentQuery,
  useListCommentsForModerationQuery,
  useGetPendingCommentCountQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useApproveCommentMutation,
  useRejectCommentMutation,
  useMarkCommentSpamMutation,
  useBatchApproveCommentsMutation,
  useBatchDeleteCommentsMutation,
} = commentsApi;
