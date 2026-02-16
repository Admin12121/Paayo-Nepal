"use client";

import { useEffect, useRef } from "react";
import { viewsApi } from "@/lib/api-client";

/**
 * Hook that records a single page view for a given content item.
 *
 * - Fires once per component mount (deduped via ref to handle React strict mode).
 * - Silently swallows errors — view tracking should never break the page.
 * - Only runs on the client (the API call goes to `/api/views`).
 *
 * @param targetType  The content type — must match backend enums.
 *                    view_target_type: "post", "video", "photo", "hotel"
 *                    like_target_type: "post", "video", "photo"
 * @param targetId    The UUID of the content item
 */
export function useViewTracker(
  targetType: string | undefined | null,
  targetId: string | undefined | null,
) {
  const hasFired = useRef(false);

  useEffect(() => {
    // Guard: don't fire if we don't have both identifiers yet
    if (!targetType || !targetId) return;

    // Guard: only fire once per mount (React strict mode calls effects twice)
    if (hasFired.current) return;
    hasFired.current = true;

    // Small delay so the view is recorded after the page has actually rendered,
    // which avoids counting bot pre-fetches / quick back-navigations.
    const timer = setTimeout(() => {
      viewsApi.record(targetType, targetId).catch(() => {
        // Silently ignore — view tracking failures should never affect UX
      });
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [targetType, targetId]);
}
