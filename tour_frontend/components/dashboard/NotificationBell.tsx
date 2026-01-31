"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  UserPlus,
  FileText,
  Image as ImageIcon,
  Check,
  CheckCheck,
} from "lucide-react";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Poll unread count every 30 seconds (fallback for when SSE is not available)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // SSE connection for real-time notifications
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      // Use full URL for SSE to ensure cookies are sent
      eventSource = new EventSource("/api/notifications/stream", {
        withCredentials: true,
      });

      eventSource.addEventListener("connected", () => {
        console.log("SSE connected for notifications");
      });

      eventSource.addEventListener("notification", (event) => {
        try {
          const notification = JSON.parse(event.data);
          // Increment unread count immediately
          setUnreadCount((prev) => prev + 1);
          // If dropdown is open, add to list
          setNotifications((prev) => [
            { ...notification, is_read: false, created_at: new Date().toISOString() },
            ...prev,
          ]);
        } catch (e) {
          console.error("Failed to parse notification:", e);
        }
      });

      eventSource.addEventListener("unread_count", (event) => {
        try {
          const data = JSON.parse(event.data);
          setUnreadCount(data.count);
        } catch (e) {
          console.error("Failed to parse unread count:", e);
        }
      });

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    // Initial fetch and SSE connection
    fetchUnreadCount();
    connectSSE();

    // Fallback polling every 60 seconds in case SSE fails
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
      clearInterval(interval);
    };
  }, [fetchUnreadCount]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=15", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  };

  const handleMarkRead = async (id: string, link: string | null) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_account":
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case "new_post_review":
        return <FileText className="h-4 w-4 text-amber-500" />;
      case "new_content":
        return <ImageIcon className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleMarkRead(notif.id, notif.link)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${!notif.is_read ? "bg-blue-50/50" : ""
                    }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${!notif.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {notif.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
