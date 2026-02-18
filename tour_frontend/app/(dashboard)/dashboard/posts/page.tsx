"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Edit, Trash2, CheckCircle } from "lucide-react";
import type { Post } from "@/lib/api-client";
import {
  useListPostsQuery,
  useDeletePostMutation,
  useApprovePostMutation,
  usePublishPostMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/utils/toast";

export default function PostsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    post: Post | null;
  }>({
    open: false,
    post: null,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListPostsQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadPosts()` pattern!
  const {
    data: postsResponse,
    isLoading,
    isFetching,
  } = useListPostsQuery({
    page: currentPage,
    limit: 20,
    sort_by: "latest",
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListPostsQuery` to refetch.
  // No more manual `loadPosts()` calls after every mutation!
  const [deletePost, { isLoading: deleting }] = useDeletePostMutation();
  const [approvePost] = useApprovePostMutation();
  const [publishPost] = usePublishPostMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const posts = postsResponse?.data ?? [];
  const totalPages = postsResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredPosts = posts.filter((post) =>
    searchQuery
      ? post.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.post) return;

    try {
      // `.unwrap()` throws on error so we can catch it.
      // On success, RTK Query invalidates 'Post' tags → list refetches automatically.
      await deletePost(deleteDialog.post.slug).unwrap();
      toast.success("Post deleted successfully");
      setDeleteDialog({ open: false, post: null });
    } catch (error) {
      toast.error("Failed to delete post");
      console.error(error);
    }
  };

  const handleApprove = async (post: Post) => {
    try {
      await approvePost(post.id).unwrap();
      toast.success("Post approved successfully");
      // No need to manually reload — cache invalidation handles it
    } catch (error) {
      toast.error("Failed to approve post");
      console.error(error);
    }
  };

  const _handlePublish = async (post: Post) => {
    try {
      await publishPost(post.id).unwrap();
      toast.success("Post published successfully");
      // No need to manually reload — cache invalidation handles it
    } catch (error) {
      toast.error("Failed to publish post");
      console.error(error);
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
          <p className="text-gray-600 mt-1">
            Manage your blog posts and articles
          </p>
        </div>
        <Link href="/dashboard/posts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3 ">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1); // Reset to page 1 when filter changes
              }}
              options={[
                { value: "all", label: "All Status" },
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ]}
              className="min-w-[150px]"
            />
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1); // Reset to page 1 when filter changes
              }}
              options={[
                { value: "all", label: "All Types" },
                { value: "article", label: "Article" },
                { value: "event", label: "Event" },
                { value: "activity", label: "Activity" },
                { value: "explore", label: "Explore" },
              ]}
              className="min-w-[150px]"
            />
          </div>
        </div>

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No posts found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[44%]">Title</TableHead>
                    <TableHead className="w-[10%]">Type</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[8%] text-right">Views</TableHead>
                    <TableHead className="w-[12%]">Date</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-[360px] lg:max-w-[520px]">
                        <div className="flex items-center gap-3">
                          {post.cover_image && (
                            <Image
                              src={post.cover_image}
                              alt={post.title}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded object-cover"
                              unoptimized={post.cover_image.startsWith(
                                "/uploads",
                              )}
                            />
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/posts/${post.slug}/edit`}
                              className="block truncate text-sm text-blue-600 hover:underline"
                              title={post.title}
                            >
                              {post.title}
                            </Link>
                            <p className="truncate text-xs text-slate-500">
                              /{post.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {post.post_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusBadgeVariant(post.status)}
                          className="capitalize"
                        >
                          {post.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.views.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(post.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {post.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(post)}
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Link href={`/dashboard/posts/${post.slug}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, post })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, post: null })}
        onConfirm={handleDelete}
        title="Delete Post"
        message={`Are you sure you want to delete "${deleteDialog.post?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
