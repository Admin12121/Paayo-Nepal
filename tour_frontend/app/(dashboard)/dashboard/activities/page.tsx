"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { activitiesApi, Activity } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/utils/toast";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    activity: Activity | null;
  }>({
    open: false,
    activity: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [currentPage]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await activitiesApi.list({
        page: currentPage,
        limit: 20,
      });
      setActivities(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error("Failed to load activities");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.activity) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/activities/${deleteDialog.activity.slug}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete activity");
      toast.success("Activity deleted successfully");
      setDeleteDialog({ open: false, activity: null });
      loadActivities();
    } catch (error) {
      toast.error("Failed to delete activity");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (activity: Activity) => {
    try {
      const response = await fetch(`/api/activities/${activity.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !activity.is_active }),
      });
      if (!response.ok) throw new Error("Failed to update activity");
      toast.success(
        `Activity ${!activity.is_active ? "activated" : "deactivated"}`,
      );
      loadActivities();
    } catch (error) {
      toast.error("Failed to update activity");
      console.error(error);
    }
  };

  const filteredActivities = activities.filter((activity) =>
    searchQuery
      ? activity.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // Sort by display order
  const sortedActivities = [...filteredActivities].sort(
    (a, b) => a.display_order - b.display_order,
  );

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

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md"
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : sortedActivities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No activities found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {sortedActivities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {activity.featured_image && (
                      <img
                        src={activity.featured_image}
                        alt={activity.name}
                        className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    {activity.icon && !activity.featured_image && (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-5xl">{activity.icon}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {activity.name}
                            </h3>
                            {activity.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div>Display Order: {activity.display_order}</div>
                            {activity.icon && <div>Icon: {activity.icon}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant={activity.is_active ? "ghost" : "secondary"}
                            size="sm"
                            onClick={() => handleToggleActive(activity)}
                          >
                            {activity.is_active ? "Deactivate" : "Activate"}
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
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, activity: null })}
        onConfirm={handleDelete}
        title="Delete Activity"
        message={`Are you sure you want to delete "${deleteDialog.activity?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
