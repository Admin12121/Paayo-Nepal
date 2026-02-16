"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { likesApi } from "@/lib/api-client";

interface LikeButtonProps {
  /** The content type — must match the backend `like_target_type` enum: 'post', 'video', or 'photo'. */
  targetType: string;
  /** The UUID of the content item. */
  targetId: string;
  /** Optional initial like count to show before the API responds. */
  initialCount?: number;
  /** Optional size variant. */
  size?: "sm" | "md" | "lg";
  /** Optional: show the count label text. */
  showLabel?: boolean;
  /** Optional additional class names. */
  className?: string;
}

export function LikeButton({
  targetType,
  targetId,
  initialCount = 0,
  size = "md",
  showLabel = true,
  className = "",
}: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch initial like status on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const status = await likesApi.status(targetType, targetId);
        if (!cancelled) {
          setLiked(status.liked);
          setCount(status.like_count);
          setInitialized(true);
        }
      } catch {
        // If fetching status fails (e.g. not logged in), just use defaults
        if (!cancelled) {
          setInitialized(true);
        }
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  const handleToggle = useCallback(async () => {
    if (loading) return;

    // Optimistic update
    const wasLiked = liked;
    const prevCount = count;
    setLiked(!wasLiked);
    setCount(wasLiked ? Math.max(0, count - 1) : count + 1);
    setAnimating(true);
    setLoading(true);

    try {
      const result = await likesApi.toggle(targetType, targetId);
      setLiked(result.liked);
      setCount(result.like_count);
    } catch {
      // Revert on failure
      setLiked(wasLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
      // Remove animation class after animation completes
      setTimeout(() => setAnimating(false), 600);
    }
  }, [loading, liked, count, targetType, targetId]);

  // Size variants
  const sizeConfig = {
    sm: {
      icon: "w-4 h-4",
      text: "text-xs",
      padding: "px-2.5 py-1.5",
      gap: "gap-1.5",
    },
    md: {
      icon: "w-5 h-5",
      text: "text-sm",
      padding: "px-3.5 py-2",
      gap: "gap-2",
    },
    lg: {
      icon: "w-6 h-6",
      text: "text-base",
      padding: "px-4 py-2.5",
      gap: "gap-2.5",
    },
  };

  const config = sizeConfig[size];

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
      className={`
        group inline-flex items-center ${config.gap} ${config.padding}
        rounded-full border transition-all duration-300 select-none
        ${
          liked
            ? "border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100"
            : "border-gray-200 bg-white text-gray-500 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500"
        }
        ${loading ? "opacity-70 cursor-wait" : "cursor-pointer"}
        ${className}
      `}
    >
      <span
        className={`
          inline-flex transition-transform duration-300
          ${animating && liked ? "animate-like-pop" : ""}
          ${animating && !liked ? "animate-like-shrink" : ""}
        `}
      >
        <Heart
          className={`
            ${config.icon} transition-all duration-300
            ${liked ? "fill-pink-500 text-pink-500" : "fill-transparent text-current"}
            ${!loading && !liked ? "group-hover:scale-110" : ""}
          `}
        />
      </span>
      {showLabel && (
        <span className={`${config.text} font-medium tabular-nums`}>
          {initialized ? count.toLocaleString() : initialCount.toLocaleString()}
        </span>
      )}
    </button>
  );
}

/**
 * A minimal icon-only like button (no border/background), suitable for
 * embedding inside cards or compact layouts.
 */
export function LikeIcon({
  targetType,
  targetId,
  initialCount = 0,
  size = "md",
  className = "",
}: Omit<LikeButtonProps, "showLabel">) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const status = await likesApi.status(targetType, targetId);
        if (!cancelled) {
          setLiked(status.liked);
          setCount(status.like_count);
        }
      } catch {
        // Ignore — guest users can't check status
      }
    }

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  const handleToggle = useCallback(async () => {
    if (loading) return;

    const wasLiked = liked;
    const prevCount = count;
    setLiked(!wasLiked);
    setCount(wasLiked ? Math.max(0, count - 1) : count + 1);
    setAnimating(true);
    setLoading(true);

    try {
      const result = await likesApi.toggle(targetType, targetId);
      setLiked(result.liked);
      setCount(result.like_count);
    } catch {
      setLiked(wasLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 600);
    }
  }, [loading, liked, count, targetType, targetId]);

  const iconSize =
    size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  const textSize =
    size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
      className={`
        inline-flex items-center gap-1.5 transition-colors duration-200
        ${liked ? "text-pink-500" : "text-gray-400 hover:text-pink-400"}
        ${loading ? "opacity-70 cursor-wait" : "cursor-pointer"}
        ${className}
      `}
    >
      <Heart
        className={`
          ${iconSize} transition-all duration-300
          ${liked ? "fill-pink-500 text-pink-500" : "fill-transparent"}
          ${animating && liked ? "scale-125" : ""}
          ${animating && !liked ? "scale-75" : ""}
        `}
      />
      <span className={`${textSize} font-medium tabular-nums`}>
        {count.toLocaleString()}
      </span>
    </button>
  );
}
