"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Edit, Trash2, CheckCircle, GripVertical } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Post } from "@/lib/api-client";
import {
  useListPostsQuery,
  useDeletePostMutation,
  useApprovePostMutation,
  usePublishPostMutation,
  useUpdatePostDisplayOrderMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
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

const EMPTY_POSTS: Post[] = [];

type PostRowProps = {
  post: Post;
  rankEnabled: boolean;
  onApprove: (post: Post) => void;
  onDelete: (post: Post) => void;
  statusBadgeVariant: (status: string) => "default" | "secondary" | "outline";
};

function DraggablePostRow({
  post,
  rankEnabled,
  onApprove,
  onDelete,
  statusBadgeVariant,
}: PostRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: post.id,
    disabled: !rankEnabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-70" : undefined}
    >
      <TableCell className="max-w-[360px] lg:max-w-[520px]">
        <div className="flex items-center gap-3">
          {rankEnabled && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab text-slate-400 active:cursor-grabbing"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 shrink-0" />
            </button>
          )}
          {post.cover_image && (
            <Image
              src={post.cover_image}
              alt={post.title}
              width={48}
              height={48}
              className="h-12 w-12 rounded object-cover"
              unoptimized={post.cover_image.startsWith("/uploads")}
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
            <p className="truncate text-xs text-slate-500">/{post.slug}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {post.post_type || post.type}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(post.status)} className="capitalize">
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
              onClick={() => onApprove(post)}
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
          <Button variant="ghost" size="sm" onClick={() => onDelete(post)}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function PostsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rankingMode, setRankingMode] = useState(false);
  const [orderedPosts, setOrderedPosts] = useState<Post[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    post: Post | null;
  }>({
    open: false,
    post: null,
  });

  const {
    data: postsResponse,
    isLoading,
    isFetching,
  } = useListPostsQuery(
    {
      page: currentPage,
      limit: 20,
      sort_by: "latest",
      status: statusFilter !== "all" ? statusFilter : undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  const [deletePost, { isLoading: deleting }] = useDeletePostMutation();
  const [approvePost] = useApprovePostMutation();
  const [publishPost] = usePublishPostMutation();
  const [updatePostDisplayOrder, { isLoading: savingOrder }] =
    useUpdatePostDisplayOrderMutation();

  const posts = postsResponse?.data ?? EMPTY_POSTS;
  const totalPages = postsResponse?.total_pages ?? 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!rankingMode) {
      setOrderedPosts(posts);
    }
  }, [posts, rankingMode]);

  const filteredPosts = useMemo(() => {
    return orderedPosts.filter((post) => {
      const normalizedType = (post.post_type || post.type || "").toLowerCase();
      const matchesType = typeFilter === "all" || normalizedType === typeFilter;
      const matchesStatus =
        statusFilter === "all" || post.status === statusFilter;
      const matchesSearch =
        searchQuery.trim() === "" ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [orderedPosts, searchQuery, statusFilter, typeFilter]);

  const canRankPosts =
    typeFilter !== "all" && statusFilter === "all" && searchQuery.trim() === "";

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const dataIds = useMemo<UniqueIdentifier[]>(
    () => filteredPosts.map((post) => post.id),
    [filteredPosts],
  );

  const handleDelete = async () => {
    if (!deleteDialog.post) return;

    try {
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
    } catch (error) {
      toast.error("Failed to approve post");
      console.error(error);
    }
  };

  const _handlePublish = async (post: Post) => {
    try {
      await publishPost(post.id).unwrap();
      toast.success("Post published successfully");
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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!rankingMode || !canRankPosts || !over || active.id === over.id) return;

    setOrderedPosts((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    if (!canRankPosts) {
      toast.error(
        "Select one type, set status to All Status, and clear search.",
      );
      return;
    }

    try {
      const base = (currentPage - 1) * 20;
      const changed = orderedPosts
        .map((post, index) => ({ post, index }))
        .filter(({ post, index }) => posts[index]?.id !== post.id);

      if (changed.length === 0) {
        toast.info("No order changes to save");
        return;
      }

      await Promise.all(
        changed.map(({ post, index }) =>
          updatePostDisplayOrder({
            id: post.id,
            display_order: base + index,
          }).unwrap(),
        ),
      );
      toast.success("Post order updated");
    } catch (error) {
      toast.error("Failed to update order");
      console.error(error);
    }
  };

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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() !== "") {
                setRankingMode(false);
              }
            }}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                const value = e.target.value;
                if (value === statusFilter) return;
                setStatusFilter(value);
                setCurrentPage(1);
                setRankingMode(false);
              }}
              className="h-9 min-w-[150px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                const value = e.target.value;
                if (value === typeFilter) return;
                setTypeFilter(value);
                setCurrentPage(1);
                setRankingMode(false);
              }}
              className="h-9 min-w-[150px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Types</option>
              <option value="article">Article</option>
              <option value="event">Event</option>
              <option value="activity">Activity</option>
              <option value="explore">Explore</option>
            </select>

            <Button
              variant={rankingMode ? "default" : "outline"}
              size="sm"
              disabled={!canRankPosts}
              onClick={() => {
                if (!canRankPosts) return;
                setRankingMode((prev) => !prev);
              }}
            >
              Rank Mode
            </Button>
            {rankingMode && (
              <Button
                size="sm"
                onClick={handleSaveOrder}
                isLoading={savingOrder}
              >
                Save Order
              </Button>
            )}
          </div>
        </div>

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
              <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                sensors={sensors}
                onDragEnd={handleDragEnd}
              >
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
                    <SortableContext
                      items={dataIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredPosts.map((post) => (
                        <DraggablePostRow
                          key={post.id}
                          post={post}
                          rankEnabled={rankingMode && canRankPosts}
                          onApprove={handleApprove}
                          onDelete={(item) =>
                            setDeleteDialog({ open: true, post: item })
                          }
                          statusBadgeVariant={statusBadgeVariant}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
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
