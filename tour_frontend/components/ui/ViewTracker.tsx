"use client";

import { useViewTracker } from "@/lib/hooks/use-view-tracker";

interface ViewTrackerProps {
  /**
   * The content type identifier sent to the backend.
   * Must match backend enums — view_target_type: "post", "video", "photo", "hotel";
   * like_target_type: "post", "video", "photo".
   */
  targetType: string;
  /**
   * The UUID of the content item whose view should be recorded.
   */
  targetId: string;
}

/**
 * Invisible client component that records a single page view when mounted.
 *
 * Drop this into any server-rendered detail page to track views without
 * converting the entire page to a client component:
 *
 * ```tsx
 * // In a server component page
 * <ViewTracker targetType="post" targetId={post.id} />
 * ```
 *
 * - Renders nothing visible (returns `null`).
 * - Fires the view API call once, ~1.5 s after mount.
 * - Silently handles errors — will never break the page.
 * - Deduplicates across React strict-mode double-mounts.
 */
export function ViewTracker({ targetType, targetId }: ViewTrackerProps) {
  useViewTracker(targetType, targetId);
  return null;
}
