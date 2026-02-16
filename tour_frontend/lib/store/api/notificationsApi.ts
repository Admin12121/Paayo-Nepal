import { baseApi, buildQueryString } from "./baseApi";
import type { Notification } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListNotificationsParams {
  limit?: number;
}

// ---------------------------------------------------------------------------
// Notifications API slice — injected into the base API
//
// Notifications are server-generated messages sent to users when certain
// events occur (e.g., new user registration, comment on their post, account
// activation, etc.).
//
// Each notification has a `type`, `title`, `message`, optional `action_url`
// for click-through, and an `is_read` boolean for tracking read status.
//
// Real-time delivery is handled via Server-Sent Events (SSE) at
// `/api/notifications/stream`. With nginx routing, SSE goes directly to
// Rust, so the dedicated Next.js SSE proxy is no longer needed.
//
// Endpoints:
//   GET  /notifications              — list notifications for current user
//   GET  /notifications/unread-count — get count of unread notifications
//   POST /notifications/:id/read     — mark a single notification as read
//   POST /notifications/read-all     — mark all notifications as read
//
// All endpoints require authentication (the user is identified from the
// session cookie).
// ---------------------------------------------------------------------------

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List notifications for the current user.
     *
     * Returns the most recent notifications, optionally limited by
     * `limit`. Sorted by `created_at` descending (newest first).
     *
     * Cache tags:
     *   - { type: 'Notification', id: 'LIST' }
     *   - { type: 'Notification', id: '<id>' } for each notification
     */
    listNotifications: builder.query<
      Notification[],
      ListNotificationsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/notifications${buildQueryString({
          limit: p.limit,
        })}`;
      },
      providesTags: (result) => {
        if (!result) {
          return [{ type: "Notification", id: "LIST" }];
        }
        return [
          { type: "Notification", id: "LIST" },
          ...result.map((item) => ({
            type: "Notification" as const,
            id: item.id,
          })),
        ];
      },
      // Short cache time — notifications are time-sensitive and may arrive
      // via SSE at any moment. The SSE handler should manually invalidate
      // these tags when new notifications arrive.
      keepUnusedDataFor: 30,
    }),

    /**
     * Get count of unread notifications for the current user.
     *
     * Returns `{ count: number }`. Used by the notification bell icon
     * in the admin header to show a badge with the unread count.
     *
     * Cache tags:
     *   - { type: 'Notification', id: 'UNREAD_COUNT' }
     *
     * This is polled frequently (via RTK Query's polling interval) or
     * invalidated when the SSE stream receives a new notification or
     * unread_count event.
     *
     * Usage:
     *   const { data } = useGetUnreadNotificationCountQuery(undefined, {
     *     pollingInterval: 60_000, // Poll every 60 seconds as fallback
     *   });
     *   const unreadCount = data?.count ?? 0;
     */
    getUnreadNotificationCount: builder.query<{ count: number }, void>({
      query: () => "/notifications/unread-count",
      providesTags: [{ type: "Notification", id: "UNREAD_COUNT" }],
      keepUnusedDataFor: 15,
    }),

    // ─── Mutations ───────────────────────────────────────────────────

    /**
     * Mark a single notification as read.
     *
     * Changes the notification's `is_read` flag from `false` to `true`.
     * Invalidates the specific notification, the list (read status may
     * affect UI rendering), and the unread count.
     *
     * Usage:
     *   const [markRead, { isLoading }] = useMarkNotificationReadMutation();
     *   await markRead(notificationId).unwrap();
     */
    markNotificationRead: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Notification", id },
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD_COUNT" },
      ],
      // Optimistic update: immediately mark as read in the UI before
      // the server responds. Reverts on failure.
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        // Optimistically update the notification list
        const patchListResult = dispatch(
          notificationsApi.util.updateQueryData(
            "listNotifications",
            undefined,
            (draft) => {
              const notification = draft.find((n) => n.id === id);
              if (notification) {
                notification.is_read = true;
              }
            },
          ),
        );

        // Optimistically decrement the unread count
        const patchCountResult = dispatch(
          notificationsApi.util.updateQueryData(
            "getUnreadNotificationCount",
            undefined,
            (draft) => {
              if (draft.count > 0) {
                draft.count -= 1;
              }
            },
          ),
        );

        try {
          await queryFulfilled;
        } catch {
          // Revert both optimistic updates if the server request failed
          patchListResult.undo();
          patchCountResult.undo();
        }
      },
    }),

    /**
     * Mark all notifications as read for the current user.
     *
     * Sets `is_read = true` on all unread notifications. Invalidates
     * the notification list and unread count.
     *
     * Usage:
     *   const [markAllRead, { isLoading }] = useMarkAllNotificationsReadMutation();
     *   await markAllRead().unwrap();
     */
    markAllNotificationsRead: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/notifications/read-all",
        method: "POST",
        body: {},
      }),
      invalidatesTags: [
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD_COUNT" },
      ],
      // Optimistic update: immediately mark all as read
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Optimistically mark all notifications as read in the list
        const patchListResult = dispatch(
          notificationsApi.util.updateQueryData(
            "listNotifications",
            undefined,
            (draft) => {
              for (const notification of draft) {
                notification.is_read = true;
              }
            },
          ),
        );

        // Optimistically set unread count to 0
        const patchCountResult = dispatch(
          notificationsApi.util.updateQueryData(
            "getUnreadNotificationCount",
            undefined,
            (draft) => {
              draft.count = 0;
            },
          ),
        );

        try {
          await queryFulfilled;
        } catch {
          // Revert both optimistic updates if the server request failed
          patchListResult.undo();
          patchCountResult.undo();
        }
      },
    }),
  }),

  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks
//
// Usage:
//   import {
//     useListNotificationsQuery,
//     useGetUnreadNotificationCountQuery,
//     useMarkNotificationReadMutation,
//     useMarkAllNotificationsReadMutation,
//   } from "@/lib/store/api/notificationsApi";
//
//   // ── List notifications ──
//   // Fetch the most recent notifications (default: all)
//   const { data: notifications, isLoading } = useListNotificationsQuery();
//
//   // Fetch with a limit
//   const { data: recent } = useListNotificationsQuery({ limit: 10 });
//
//   // ── Unread count (with polling fallback) ──
//   // The SSE stream handles real-time updates, but we poll every 60s
//   // as a safety net in case the SSE connection drops.
//   const { data: unreadData } = useGetUnreadNotificationCountQuery(
//     undefined,
//     { pollingInterval: 60_000 },
//   );
//   const unreadCount = unreadData?.count ?? 0;
//
//   // ── Mark a single notification as read ──
//   const [markRead, { isLoading: marking }] =
//     useMarkNotificationReadMutation();
//   const handleClick = async (notificationId: string) => {
//     await markRead(notificationId).unwrap();
//   };
//
//   // ── Mark all as read ──
//   const [markAllRead, { isLoading: markingAll }] =
//     useMarkAllNotificationsReadMutation();
//   const handleMarkAllRead = async () => {
//     await markAllRead().unwrap();
//   };
//
// ---------------------------------------------------------------------------
// SSE Integration
//
// To integrate with the SSE notification stream for real-time updates,
// use the `baseApi.util.invalidateTags` action in your SSE event handler:
//
//   import { baseApi } from "@/lib/store/api/baseApi";
//
//   // In your SSE event handler (e.g., in the notification bell component):
//   eventSource.addEventListener("notification", () => {
//     dispatch(baseApi.util.invalidateTags([
//       { type: "Notification", id: "LIST" },
//       { type: "Notification", id: "UNREAD_COUNT" },
//     ]));
//   });
//
//   eventSource.addEventListener("unread_count", () => {
//     dispatch(baseApi.util.invalidateTags([
//       { type: "Notification", id: "UNREAD_COUNT" },
//     ]));
//   });
//
// This triggers RTK Query to refetch the notification list and unread
// count, which updates the UI automatically.
// ---------------------------------------------------------------------------

export const {
  useListNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
