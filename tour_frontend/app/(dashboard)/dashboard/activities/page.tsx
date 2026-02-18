"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Edit, Trash2, Image as ImageIcon } from "lucide-react";
import type { Post } from "@/lib/api-client";
import {
  useListActivitiesQuery,
  useDeleteActivityMutation,
  useUpdateActivityMutation,
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

export default function ActivitiesPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
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
  } = useListActivitiesQuery({
    page: currentPage,
    limit: 20,
  });

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListActivitiesQuery` to refetch.
  // No more manual `loadActivities()` calls after every mutation!
  const [deleteActivity, { isLoading: deleting }] = useDeleteActivityMutation();
  const [updateActivity] = useUpdateActivityMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const activities = activitiesResponse?.data ?? [];
  const totalPages = activitiesResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredActivities = activities.filter((activity) =>
    searchQuery
      ? activity.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // Sort by display order
  const sortedActivities = [...filteredActivities].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0),
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
        </div>

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : sortedActivities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No activities found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
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
                  {sortedActivities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="max-w-[360px] lg:max-w-[520px]">
                        <div className="flex items-center gap-3">
                          {activity.cover_image ? (
                            <Image
                              src={activity.cover_image}
                              alt={activity.title}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded object-cover"
                              unoptimized={activity.cover_image.startsWith(
                                "/uploads",
                              )}
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
                            <p className="truncate text-xs text-slate-500">
                              /{activity.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            activity.status === "published"
                              ? "default"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {activity.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={activity.is_featured ? "default" : "outline"}
                        >
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
                            variant={
                              activity.is_featured ? "ghost" : "secondary"
                            }
                            size="sm"
                            onClick={() => handleToggleActive(activity)}
                          >
                            {activity.is_featured ? "Unfeature" : "Feature"}
                          </Button>
                          <Link
                            href={`/dashboard/activities/${activity.slug}/edit`}
                          >
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, activity })
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
