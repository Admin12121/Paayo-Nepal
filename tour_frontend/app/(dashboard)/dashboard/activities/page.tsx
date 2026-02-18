"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  GripVertical,
} from "lucide-react";
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
  useListActivitiesQuery,
  useDeleteActivityMutation,
  useUpdateActivityMutation,
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

const EMPTY_ACTIVITIES: Post[] = [];

function DraggableActivityRow({
  activity,
  rankEnabled,
  onToggleFeatured,
  onDelete,
}: {
  activity: Post;
  rankEnabled: boolean;
  onToggleFeatured: (activity: Post) => void;
  onDelete: (activity: Post) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: activity.id,
    disabled: !rankEnabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
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
            >
              <GripVertical className="h-4 w-4 shrink-0" />
            </button>
          )}
          {activity.cover_image ? (
            <Image
              src={activity.cover_image}
              alt={activity.title}
              width={48}
              height={48}
              className="h-12 w-12 rounded object-cover"
              unoptimized={activity.cover_image.startsWith("/uploads")}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100">
              <ImageIcon className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div className="min-w-0">
            <Link
              href={`/dashboard/activities/${activity.slug}/edit`}
              className="block truncate text-sm text-blue-600 hover:underline"
              title={activity.title}
            >
              {activity.title}
            </Link>
            <p className="truncate text-xs text-slate-500">/{activity.slug}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={activity.status === "published" ? "default" : "outline"}
          className="capitalize"
        >
          {activity.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={activity.is_featured ? "default" : "outline"}>
          {activity.is_featured ? "yes" : "no"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {(activity.display_order || 0).toLocaleString()}
      </TableCell>
      <TableCell className="text-slate-600">
        {new Date(activity.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant={activity.is_featured ? "ghost" : "secondary"}
            size="sm"
            onClick={() => onToggleFeatured(activity)}
          >
            {activity.is_featured ? "Unfeature" : "Feature"}
          </Button>
          <Link href={`/dashboard/activities/${activity.slug}/edit`}>
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => onDelete(activity)}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ActivitiesPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [rankingMode, setRankingMode] = useState(false);
  const [orderedActivities, setOrderedActivities] = useState<Post[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    activity: Post | null;
  }>({
    open: false,
    activity: null,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListActivitiesQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadActivities()` pattern!
  const {
    data: activitiesResponse,
    isLoading,
    isFetching,
  } = useListActivitiesQuery(
    {
      page: currentPage,
      limit: 20,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListActivitiesQuery` to refetch.
  // No more manual `loadActivities()` calls after every mutation!
  const [deleteActivity, { isLoading: deleting }] = useDeleteActivityMutation();
  const [updateActivity] = useUpdateActivityMutation();
  const [updatePostDisplayOrder, { isLoading: savingOrder }] =
    useUpdatePostDisplayOrderMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const activities = activitiesResponse?.data ?? EMPTY_ACTIVITIES;
  const totalPages = activitiesResponse?.total_pages ?? 1;

  useEffect(() => {
    setOrderedActivities(
      [...activities].sort(
        (a, b) => (a.display_order || 0) - (b.display_order || 0),
      ),
    );
  }, [activities]);

  // Client-side search filter (instant, no network request)
  const filteredActivities = orderedActivities.filter((activity) =>
    searchQuery
      ? activity.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const canRankActivities = searchQuery.trim() === "";
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );
  const dataIds = useMemo<UniqueIdentifier[]>(
    () => filteredActivities.map((activity) => activity.id),
    [filteredActivities],
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.activity) return;

    try {
      // `.unwrap()` throws on error so we can catch it.
      // On success, RTK Query invalidates 'Activity' tags → list refetches automatically.
      await deleteActivity(deleteDialog.activity.slug).unwrap();
      toast.success("Activity deleted successfully");
      setDeleteDialog({ open: false, activity: null });
    } catch (error) {
      toast.error("Failed to delete activity");
      console.error(error);
    }
  };

  const handleToggleActive = async (activity: Post) => {
    try {
      // Use the RTK Query mutation instead of raw fetch().
      // On success, cache invalidation triggers automatic refetch of the list.
      await updateActivity({
        slug: activity.slug,
        data: { is_featured: !activity.is_featured },
      }).unwrap();
      toast.success(
        `Activity ${!activity.is_featured ? "featured" : "unfeatured"}`,
      );
      // No need to manually reload — cache invalidation handles it
    } catch (error) {
      toast.error("Failed to update activity");
      console.error(error);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!rankingMode || !canRankActivities || !over || active.id === over.id)
      return;
    setOrderedActivities((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    if (!canRankActivities) {
      toast.error("Clear search to reorder.");
      return;
    }
    try {
      const base = (currentPage - 1) * 20;
      const changed = orderedActivities
        .map((activity, index) => ({ activity, index }))
        .filter(({ activity, index }) => activities[index]?.id !== activity.id);
      if (changed.length === 0) {
        toast.info("No order changes to save");
        return;
      }
      await Promise.all(
        changed.map(({ activity, index }) =>
          updatePostDisplayOrder({
            id: activity.id,
            display_order: base + index,
          }).unwrap(),
        ),
      );
      toast.success("Activity order updated");
    } catch (error) {
      toast.error("Failed to update order");
      console.error(error);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-600 mt-1">
            Manage tourism activities and experiences
          </p>
        </div>
        <Link href="/dashboard/activities/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Activity
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3 ">
            <Button
              variant={rankingMode ? "default" : "outline"}
              size="sm"
              disabled={!canRankActivities}
              onClick={() => setRankingMode((prev) => !prev)}
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

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No activities found</p>
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
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[10%]">Featured</TableHead>
                      <TableHead className="w-[8%] text-right">Order</TableHead>
                      <TableHead className="w-[12%]">Created</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={dataIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredActivities.map((activity) => (
                        <DraggableActivityRow
                          key={activity.id}
                          activity={activity}
                          rankEnabled={rankingMode && canRankActivities}
                          onToggleFeatured={handleToggleActive}
                          onDelete={(item) =>
                            setDeleteDialog({ open: true, activity: item })
                          }
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
        onClose={() => setDeleteDialog({ open: false, activity: null })}
        onConfirm={handleDelete}
        title="Delete Activity"
        message={`Are you sure you want to delete "${deleteDialog.activity?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
