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
import DashboardCard from "@/components/dashboard/DashboardCard";
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

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="p-4 border-b">
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md"
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
          <>
            <div className="divide-y divide-gray-200">
              {sortedActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {activity.cover_image && (
                      <Image
                        src={activity.cover_image}
                        alt={activity.title}
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg shrink-0"
                        unoptimized={activity.cover_image.startsWith(
                          "/uploads",
                        )}
                      />
                    )}
                    {!activity.cover_image && (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <ImageIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {activity.title}
                            </h3>
                            {activity.is_featured ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Featured
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Not Featured
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activity.status === "published" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}`}
                            >
                              {activity.status}
                            </span>
                          </div>
                          {activity.short_description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {activity.short_description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div>
                              Display Order: {activity.display_order || 0}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </DashboardCard>

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
