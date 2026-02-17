"use client";

import { useState } from "react";
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Clock,
  Mail,
  CheckSquare,
  Square,
} from "lucide-react";
import type { Comment } from "@/lib/api-client";
import {
  useListCommentsForModerationQuery,
  useGetPendingCommentCountQuery,
  useApproveCommentMutation,
  useRejectCommentMutation,
  useMarkCommentSpamMutation,
  useDeleteCommentMutation,
  useBatchApproveCommentsMutation,
  useBatchDeleteCommentsMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

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

export default function CommentsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    comment: Comment | null;
  }>({ open: false, comment: null });
  const [expandedComment, setExpandedComment] = useState<string | null>(null);

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListCommentsForModerationQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadComments()` pattern!
  const {
    data: commentsResponse,
    isLoading,
    isFetching,
  } = useListCommentsForModerationQuery({
    page: currentPage,
    limit: 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { data: pendingCountData } = useGetPendingCommentCountQuery();

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing the list query to refetch.
  // No more manual `loadComments()` calls after every mutation!
  const [approveComment] = useApproveCommentMutation();
  const [rejectComment] = useRejectCommentMutation();
  const [markCommentSpam] = useMarkCommentSpamMutation();
  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();
  const [batchApproveComments, { isLoading: batchApproving }] =
    useBatchApproveCommentsMutation();
  const [batchDeleteComments, { isLoading: batchDeleting }] =
    useBatchDeleteCommentsMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const comments = commentsResponse?.data ?? [];
  const totalPages = commentsResponse?.total_pages ?? 1;
  const total = commentsResponse?.total ?? 0;
  const pendingCount = pendingCountData?.count ?? 0;

  // Client-side search filter (instant, no network request)
  const filteredComments = comments.filter((comment) =>
    searchQuery
      ? comment.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.guest_email.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleApprove = async (comment: Comment) => {
    try {
      await approveComment(comment.id).unwrap();
      toast.success("Comment approved");
    } catch {
      toast.error("Failed to approve comment");
    }
  };

  const handleReject = async (comment: Comment) => {
    try {
      await rejectComment(comment.id).unwrap();
      toast.success("Comment rejected");
    } catch {
      toast.error("Failed to reject comment");
    }
  };

  const handleMarkSpam = async (comment: Comment) => {
    try {
      await markCommentSpam(comment.id).unwrap();
      toast.success("Comment marked as spam");
    } catch {
      toast.error("Failed to mark comment as spam");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.comment) return;

    try {
      await deleteComment(deleteDialog.comment.id).unwrap();
      toast.success("Comment deleted");
      setDeleteDialog({ open: false, comment: null });
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;

    try {
      await batchApproveComments(Array.from(selectedIds)).unwrap();
      toast.success(`${selectedIds.size} comment(s) approved`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to batch approve comments");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      await batchDeleteComments(Array.from(selectedIds)).unwrap();
      toast.success(`${selectedIds.size} comment(s) deleted`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to batch delete comments");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredComments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredComments.map((c) => c.id)));
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case "spam":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
            <AlertTriangle className="w-3 h-3" />
            Spam
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Comments Moderation
          </h1>
          <p className="text-gray-600 mt-1">
            Review and moderate guest comments
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                <Clock className="w-3 h-3" />
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {(
          [
            {
              label: "All",
              value: "all",
              count: total,
              color: "bg-gray-50 text-gray-700 border-gray-200",
            },
            {
              label: "Pending",
              value: "pending",
              count: pendingCount,
              color: "bg-yellow-50 text-yellow-700 border-yellow-200",
            },
            {
              label: "Approved",
              value: "approved",
              count: null,
              color: "bg-green-50 text-green-700 border-green-200",
            },
            {
              label: "Spam",
              value: "spam",
              count: null,
              color: "bg-orange-50 text-orange-700 border-orange-200",
            },
          ] as const
        ).map((stat) => (
          <Button
            key={stat.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter(stat.value);
              setCurrentPage(1);
            }}
            className={`h-auto w-full justify-start p-3 text-left ${
              statusFilter === stat.value
                ? `${stat.color} border-current ring-1 ring-current/20`
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <p className="text-sm font-medium">{stat.label}</p>
            {stat.count !== null && (
              <p className="text-xl font-bold mt-1">{stat.count}</p>
            )}
          </Button>
        ))}
      </div>

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name, email, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Status" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "spam", label: "Spam" },
            ]}
            className="min-w-[150px]"
          />
        </div>

        {/* Batch actions bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-4">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              onClick={handleBatchApprove}
              disabled={batchApproving}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              {batchApproving ? "Approving..." : "Approve All"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleBatchDelete}
              disabled={batchDeleting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {batchDeleting ? "Deleting..." : "Delete All"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto h-auto p-0 text-sm text-blue-600 hover:bg-transparent hover:text-blue-800"
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-1">No comments found</p>
            <p className="text-sm">
              {statusFilter !== "all"
                ? `No ${statusFilter} comments to show.`
                : "No comments have been posted yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Select all header */}
            <div className="px-6 py-2 bg-gray-50 flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="h-auto p-0 text-gray-400 hover:bg-transparent hover:text-gray-600"
              >
                {selectedIds.size === filteredComments.length &&
                filteredComments.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </Button>
              <span className="text-xs text-gray-500 uppercase font-medium">
                Select all
              </span>
            </div>

            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className={`px-6 py-4 transition-colors ${
                  selectedIds.has(comment.id)
                    ? "bg-blue-50/50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelect(comment.id)}
                    className="mt-1 h-auto flex-shrink-0 p-0 text-gray-400 hover:bg-transparent hover:text-gray-600"
                  >
                    {selectedIds.has(comment.id) ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0078C0] to-[#00A3E0] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {comment.guest_name
                        ? comment.guest_name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "?"}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {comment.guest_name || "Anonymous"}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {comment.guest_email}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(comment.created_at)}
                      </span>
                      {getStatusBadge(comment.status)}
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      On{" "}
                      <span className="font-medium capitalize">
                        {comment.target_type}
                      </span>{" "}
                      <span className="text-gray-400">
                        ({comment.target_id.slice(0, 8)}…)
                      </span>
                      {comment.parent_id && (
                        <span className="ml-2 text-blue-500">
                          ↳ Reply to {comment.parent_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words ${
                        expandedComment === comment.id ? "" : "line-clamp-3"
                      }`}
                    >
                      {comment.content}
                    </p>

                    {comment.content.length > 200 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedComment(
                            expandedComment === comment.id ? null : comment.id,
                          )
                        }
                        className="mt-1 h-auto p-0 text-xs text-blue-600 hover:bg-transparent hover:text-blue-800"
                      >
                        {expandedComment === comment.id
                          ? "Show less"
                          : "Show more"}
                      </Button>
                    )}

                    {/* IP & hash info */}
                    {(comment.ip_address || comment.viewer_hash) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {comment.ip_address && (
                          <span>IP: {comment.ip_address}</span>
                        )}
                        {comment.viewer_hash && (
                          <span>Hash: {comment.viewer_hash.slice(0, 12)}…</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {comment.status !== "approved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(comment)}
                        title="Approve"
                        className="text-green-600 hover:bg-green-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    {comment.status !== "rejected" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(comment)}
                        title="Reject"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                    {comment.status !== "spam" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkSpam(comment)}
                        title="Mark as spam"
                        className="text-orange-600 hover:bg-orange-50"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, comment })}
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </DashboardCard>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, comment: null })}
        onConfirm={handleDelete}
        title="Delete Comment"
        message={`Are you sure you want to permanently delete this comment by "${deleteDialog.comment?.guest_name}"? This will also delete all replies. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
