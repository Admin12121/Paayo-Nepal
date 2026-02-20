"use client";

import { useMemo, useState } from "react";
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Clock,
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
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    comment: Comment | null;
  }>({ open: false, comment: null });

  const {
    data: commentsResponse,
    isLoading,
    isFetching,
  } = useListCommentsForModerationQuery(
    {
      page: currentPage,
      limit: 20,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  const { data: pendingCountData } = useGetPendingCommentCountQuery();
  const [approveComment] = useApproveCommentMutation();
  const [rejectComment] = useRejectCommentMutation();
  const [markCommentSpam] = useMarkCommentSpamMutation();
  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();
  const [batchApproveComments, { isLoading: batchApproving }] =
    useBatchApproveCommentsMutation();
  const [batchDeleteComments, { isLoading: batchDeleting }] =
    useBatchDeleteCommentsMutation();

  const comments = commentsResponse?.data ?? [];
  const totalPages = commentsResponse?.total_pages ?? 1;
  const total = commentsResponse?.total ?? 0;
  const pendingCount = pendingCountData?.count ?? 0;

  const filteredComments = useMemo(
    () =>
      comments.filter((comment) =>
        searchQuery
          ? comment.guest_name
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            comment.guest_email
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          : true,
      ),
    [comments, searchQuery],
  );

  const allPageSelected =
    filteredComments.length > 0 &&
    filteredComments.every((comment) => selectedIds.has(comment.id));
  const somePageSelected =
    filteredComments.some((comment) => selectedIds.has(comment.id)) &&
    !allPageSelected;

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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteDialog.comment!.id);
        return next;
      });
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

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }

    const next = new Set(selectedIds);
    filteredComments.forEach((comment) => next.add(comment.id));
    setSelectedIds(next);
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "spam":
      case "rejected":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comments</h1>
          <p className="mt-1 text-gray-600">
            Review and moderate guest comments
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                <Clock className="h-3 w-3" />
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "All", value: "all", count: total },
          { label: "Pending", value: "pending", count: pendingCount },
          { label: "Approved", value: "approved", count: null },
          { label: "Spam", value: "spam", count: null },
        ].map((stat) => (
          <Button
            key={stat.value}
            type="button"
            variant={statusFilter === stat.value ? "outline" : "ghost"}
            onClick={() => {
              setStatusFilter(stat.value);
              setCurrentPage(1);
            }}
            className="h-auto justify-start border px-3 py-2 text-left"
          >
            <div>
              <p className="text-sm font-medium">{stat.label}</p>
              {stat.count !== null && (
                <p className="mt-1 text-xl font-bold">{stat.count}</p>
              )}
            </div>
          </Button>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex w-full flex-row flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
          <Input
            placeholder="Search by name, email, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[360px]"
          />
          <div className="flex flex-row gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 border-t border-blue-100 bg-blue-50 px-4 py-3">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              onClick={handleBatchApprove}
              disabled={batchApproving}
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              {batchApproving ? "Approving..." : "Approve All"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleBatchDelete}
              disabled={batchDeleting}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {batchDeleting ? "Deleting..." : "Delete All"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}

        {isFetching && !isLoading && (
          <div className="h-0.5 overflow-hidden bg-blue-100">
            <div className="h-full w-full animate-pulse bg-blue-500" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredComments.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <MessageSquare className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <p className="text-lg font-medium">No comments found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <Table className="table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={
                          allPageSelected ||
                          (somePageSelected && "indeterminate")
                        }
                        onCheckedChange={(checked) =>
                          toggleSelectAll(Boolean(checked))
                        }
                        aria-label="Select all"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[20%]">Author</TableHead>
                  <TableHead className="w-[36%]">Comment</TableHead>
                  <TableHead className="w-[14%]">On</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[10%]">Date</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(comment.id)}
                          onCheckedChange={(checked) =>
                            toggleSelect(comment.id, Boolean(checked))
                          }
                          aria-label="Select row"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {comment.guest_name || "Anonymous"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {comment.guest_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[480px]">
                      <p
                        className="truncate text-sm text-slate-700"
                        title={comment.content}
                      >
                        {comment.content}
                      </p>
                      {(comment.ip_address || comment.viewer_hash) && (
                        <p className="truncate text-xs text-slate-400">
                          {comment.ip_address
                            ? `IP: ${comment.ip_address}`
                            : ""}
                          {comment.ip_address && comment.viewer_hash
                            ? " | "
                            : ""}
                          {comment.viewer_hash
                            ? `Hash: ${comment.viewer_hash.slice(0, 12)}...`
                            : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-xs text-slate-600 capitalize">
                        {comment.target_type}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {comment.target_id.slice(0, 8)}...
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(comment.status)}
                        className="capitalize"
                      >
                        {comment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {timeAgo(comment.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {comment.status !== "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(comment)}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {comment.status !== "rejected" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(comment)}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                        {comment.status !== "spam" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkSpam(comment)}
                            title="Mark as spam"
                          >
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteDialog({ open: true, comment })
                          }
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, comment: null })}
        onConfirm={handleDelete}
        title="Delete Comment"
        message={`Are you sure you want to permanently delete this comment by "${deleteDialog.comment?.guest_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
