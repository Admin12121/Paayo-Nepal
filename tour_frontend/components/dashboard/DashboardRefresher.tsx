"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * DashboardRefresher — a headless client component that listens for real-time
 * SSE notification events and triggers `router.refresh()` so that the
 * server-rendered dashboard stats are re-fetched without a full page reload.
 *
 * Special handling for "verified" notifications:
 * When an admin activates/deactivates/blocks/unblocks an editor, the backend
 * sends a "verified" type notification to that editor via SSE. This component
 * catches it, invalidates the better-auth session cookie cache (so the stale
 * `isActive` value is cleared), and forces a full page reload so the
 * DashboardLayout server component reads fresh session data from the DB.
 *
 * Drop this component anywhere inside the dashboard page. It renders nothing
 * visible — it only sets up the EventSource listener.
 */
export default function DashboardRefresher() {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectSSE = () => {
      try {
        eventSource = new EventSource("/api/notifications/stream", {
          withCredentials: true,
        });

        eventSource.addEventListener("notification", (event) => {
          try {
            const data = JSON.parse(event.data);
            const notifType = data?.type as string | undefined;

            // ----------------------------------------------------------
            // "verified" notification = admin changed this user's status
            // (activated / deactivated / blocked / unblocked).
            //
            // We need to:
            // 1. Show a toast so the editor knows what happened
            // 2. Invalidate the session cookie cache
            // 3. Force a full page reload so the server component
            //    re-reads isActive from the database
            // ----------------------------------------------------------
            if (notifType === "verified") {
              const title = data.title || "Account Status Changed";
              const message = data.message || "Your account status has been updated by an administrator.";

              toast.info(title, {
                description: message,
                duration: 8000,
              });

              // Invalidate the better-auth session data cache cookie,
              // then force a hard reload so the DashboardLayout server
              // component reads fresh session data from the DB.
              fetch("/api/auth/invalidate-session-cache", {
                method: "POST",
                credentials: "include",
              })
                .catch(() => {
                  // Invalidation failed — reload anyway; the cookie cache
                  // will expire on its own within maxAge seconds.
                })
                .finally(() => {
                  // Small delay so the toast is visible before reload
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                });

              return; // Don't do the normal router.refresh() below
            }
          } catch {
            // Couldn't parse notification data — fall through to generic refresh
          }

          // Throttle refreshes — at most once every 3 seconds to avoid
          // hammering the server when many notifications arrive at once.
          const now = Date.now();
          if (now - lastRefreshRef.current > 3000) {
            lastRefreshRef.current = now;
            router.refresh();
          }
        });

        eventSource.addEventListener("unread_count", () => {
          // An unread_count update also implies something changed — refresh.
          const now = Date.now();
          if (now - lastRefreshRef.current > 3000) {
            lastRefreshRef.current = now;
            router.refresh();
          }
        });

        eventSource.onerror = () => {
          eventSource?.close();
          // Reconnect after 10 seconds (longer than NotificationBell's 5s to
          // avoid two reconnects racing).
          reconnectTimeout = setTimeout(connectSSE, 10_000);
        };
      } catch {
        // EventSource constructor can throw if the URL is invalid — unlikely
        // in practice but be safe.
        reconnectTimeout = setTimeout(connectSSE, 10_000);
      }
    };

    connectSSE();

    // Also do a periodic refresh every 60 seconds as a fallback in case SSE
    // drops silently.
    const intervalId = setInterval(() => {
      router.refresh();
    }, 60_000);

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
      clearInterval(intervalId);
    };
  }, [router]);

  // This component renders nothing — it's purely a side-effect hook wrapper.
  return null;
}
