"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Edit, Trash2, MapPin, Star, Eye } from "lucide-react";
import type { Post } from "@/lib/api-client";
import {
  useListAttractionsQuery,
  useDeleteAttractionMutation,
  useListRegionsQuery,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

export default function AttractionsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [topFilter, setTopFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    attraction: Post | null;
  }>({
    open: false,
    attraction: null,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListAttractionsQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadAttractions()` pattern!
  const {
    data: attractionsResponse,
    isLoading,
    isFetching,
  } = useListAttractionsQuery({
    page: currentPage,
    limit: 20,
    region_id: regionFilter !== "all" ? regionFilter : undefined,
    is_featured: topFilter === "top" ? true : undefined,
  });

  // Load regions for the filter dropdown (large limit to get all)
  const { data: regionsResponse } = useListRegionsQuery({ limit: 100 });

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListAttractionsQuery` to refetch.
  // No more manual `loadAttractions()` calls after every mutation!
  const [deleteAttraction, { isLoading: deleting }] =
    useDeleteAttractionMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const attractions = attractionsResponse?.data ?? [];
  const totalPages = attractionsResponse?.total_pages ?? 1;
  const regions = regionsResponse?.data ?? [];

  // Client-side search filter (instant, no network request)
  const filteredAttractions = attractions.filter((attraction) =>
    searchQuery
      ? attraction.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.attraction) return;

    try {
      // `.unwrap()` throws on error so we can catch it.
      // On success, RTK Query invalidates 'Attraction' tags → list refetches automatically.
      await deleteAttraction(deleteDialog.attraction.slug).unwrap();
      toast.success("Attraction deleted successfully");
      setDeleteDialog({ open: false, attraction: null });
    } catch (error) {
      toast.error("Failed to delete attraction");
      console.error(error);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attractions</h1>
          <p className="text-gray-600 mt-1">
            Manage tourist attractions and landmarks
          </p>
        </div>
        <Link href="/dashboard/attractions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Attraction
          </Button>
        </Link>
      </div>

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search attractions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Regions" },
              ...regions.map((r) => ({ value: r.id, label: r.name })),
            ]}
            className="min-w-[150px]"
          />
          <Select
            value={topFilter}
            onChange={(e) => {
              setTopFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Attractions" },
              { value: "top", label: "Top Attractions" },
            ]}
            className="min-w-[150px]"
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
        ) : filteredAttractions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No attractions found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {filteredAttractions.map((attraction) => (
                <div
                  key={attraction.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {attraction.cover_image && (
                      <Image
                        src={attraction.cover_image}
                        alt={attraction.title}
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg shrink-0"
                        unoptimized={attraction.cover_image.startsWith(
                          "/uploads",
                        )}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {attraction.title}
                          </h3>
                          {attraction.short_description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {attraction.short_description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {attraction.likes ??
                                attraction.like_count ??
                                0}{" "}
                              likes
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${attraction.status === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                            >
                              {attraction.status}
                            </span>
                          </div>
                          <div className="mt-2">
                            {attraction.is_featured && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Star className="w-3 h-3 mr-1" />
                                Featured
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/dashboard/attractions/${attraction.slug}/edit`}
                          >
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, attraction })
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
        onClose={() => setDeleteDialog({ open: false, attraction: null })}
        onConfirm={handleDelete}
        title="Delete Attraction"
        message={`Are you sure you want to delete "${deleteDialog.attraction?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
