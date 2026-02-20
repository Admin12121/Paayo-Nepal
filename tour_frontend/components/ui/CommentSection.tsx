"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  User,
  Send,
  ChevronDown,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  ApiError,
  commentsApi,
  Comment,
  PaginatedResponse,
} from "@/lib/api-client";

interface CommentSectionProps {
  targetType: string;
  targetId: string;
}

interface CommentFormData {
  guest_name: string;
  guest_email: string;
  content: string;
}

const COMMENTS_PER_PAGE = 10;

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0078C0] to-[#00A3E0] flex items-center justify-center shrink-0">
        <span className="text-white text-xs font-bold">
          {comment.guest_name ? (
            getInitials(comment.guest_name)
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {comment.guest_name || "Anonymous"}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
            <Clock className="w-3 h-3" />
            {timeAgo(comment.created_at)}
          </span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

function CommentForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (data: CommentFormData) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<CommentFormData>({
    guest_name: "",
    guest_email: "",
    content: "",
  });
  const [errors, setErrors] = useState<Partial<CommentFormData>>({});

  const validate = (): boolean => {
    const newErrors: Partial<CommentFormData> = {};

    if (!formData.guest_name.trim()) {
      newErrors.guest_name = "Name is required";
    } else if (formData.guest_name.trim().length < 2) {
      newErrors.guest_name = "Name must be at least 2 characters";
    }

    if (!formData.guest_email.trim()) {
      newErrors.guest_email = "Email is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guest_email.trim())
    ) {
      newErrors.guest_email = "Invalid email address";
    }

    if (!formData.content.trim()) {
      newErrors.content = "Comment is required";
    } else if (formData.content.trim().length < 3) {
      newErrors.content = "Comment must be at least 3 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      guest_name: formData.guest_name.trim(),
      guest_email: formData.guest_email.trim(),
      content: formData.content.trim(),
    });

    // Keep name and email for convenience, clear comment
    setFormData((prev) => ({ ...prev, content: "" }));
    setErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label
            htmlFor="comment-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="comment-name"
            type="text"
            placeholder="Your name"
            value={formData.guest_name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, guest_name: e.target.value }));
              if (errors.guest_name)
                setErrors((prev) => ({ ...prev, guest_name: undefined }));
            }}
            className={`w-full h-10 px-3 rounded-lg border text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078C0] focus:border-transparent transition-colors ${
              errors.guest_name
                ? "border-red-400 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
            disabled={isSubmitting}
          />
          {errors.guest_name && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.guest_name}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="comment-email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="comment-email"
            type="email"
            placeholder="your@email.com"
            value={formData.guest_email}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, guest_email: e.target.value }));
              if (errors.guest_email)
                setErrors((prev) => ({ ...prev, guest_email: undefined }));
            }}
            className={`w-full h-10 px-3 rounded-lg border text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078C0] focus:border-transparent transition-colors ${
              errors.guest_email
                ? "border-red-400 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
            disabled={isSubmitting}
          />
          {errors.guest_email && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.guest_email}
            </p>
          )}
        </div>
      </div>

      {/* Comment Content */}
      <div>
        <label
          htmlFor="comment-content"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Comment <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <textarea
            id="comment-content"
            rows={3}
            placeholder="Write your comment..."
            value={formData.content}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, content: e.target.value }));
              if (errors.content)
                setErrors((prev) => ({ ...prev, content: undefined }));
            }}
            className={`w-full px-3 py-2 rounded-lg border text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078C0] focus:border-transparent resize-none transition-colors ${
              errors.content
                ? "border-red-400 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
            disabled={isSubmitting}
          />
          {errors.content && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.content}
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Your email will not be published.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0078C0] text-white rounded-lg hover:bg-[#0068A0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Posting…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Post Comment
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function CommentSection({ targetType, targetId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(
    async (pageNum: number, append = false) => {
      if (!targetId?.trim()) {
        setComments([]);
        setTotal(0);
        setPage(1);
        setTotalPages(1);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        let response: PaginatedResponse<Comment>;
        try {
          response = await commentsApi.listForContent({
            target_type: targetType,
            target_id: targetId,
            page: pageNum,
            limit: COMMENTS_PER_PAGE,
          });
        } catch (err) {
          const status =
            err instanceof ApiError
              ? err.status
              : typeof err === "object" &&
                  err !== null &&
                  "status" in err &&
                  typeof (err as { status?: unknown }).status === "number"
                ? ((err as { status: number }).status ?? undefined)
                : undefined;
          const isNotFound =
            status === 404 ||
            (err instanceof Error &&
              err.message.toLowerCase().includes("not found"));
          if (isNotFound) {
            // Compatibility fallback: treat missing comments route/content as empty.
            response = {
              data: [],
              total: 0,
              page: pageNum,
              limit: COMMENTS_PER_PAGE,
              total_pages: 1,
            };
          } else {
            throw err;
          }
        }

        if (append) {
          setComments((prev) => [...prev, ...response.data]);
        } else {
          setComments(response.data);
        }
        setTotal(response.total);
        setPage(response.page);
        setTotalPages(response.total_pages);
      } catch (err) {
        console.error("Failed to fetch comments:", err);
        // Don't show error for empty comments — that's normal
        if (!append) {
          setComments([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [targetId, targetType],
  );

  useEffect(() => {
    if (!targetId?.trim()) return;
    fetchComments(1);
  }, [fetchComments, targetId]);

  const handleSubmit = async (data: CommentFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSubmitSuccess(false);

      await commentsApi.create({
        target_type: targetType,
        target_id: targetId,
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        content: data.content,
      });

      setSubmitSuccess(true);

      // Refresh comments from page 1
      await fetchComments(1);

      // Auto-hide success message after 5s
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to post comment. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      fetchComments(page + 1, true);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
      <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-1 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-[#0078C0]" />
        Comments
        {total > 0 && (
          <span className="text-sm font-normal text-gray-500">({total})</span>
        )}
      </h3>
      <p className="text-sm text-gray-500 mb-6">Share your thoughts with us</p>

      {/* Comment Form */}
      <div className="mb-8 pb-6 border-b border-gray-100">
        <CommentForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />

        {/* Success message */}
        {submitSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✓ Comment submitted! It may need moderation before appearing.
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Comment List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <>
          <div className="divide-y divide-gray-100">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>

          {/* Load More */}
          {page < totalPages && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {loadingMore ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Loading…
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Load More Comments
                  </>
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      )}
    </div>
  );
}
