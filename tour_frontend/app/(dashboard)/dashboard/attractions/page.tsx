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

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search attractions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3 ">
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
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[44%]">Title</TableHead>
                    <TableHead className="w-[14%]">Region</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[8%] text-right">Likes</TableHead>
                    <TableHead className="w-[12%]">Created</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttractions.map((attraction) => (
                    <TableRow key={attraction.id}>
                      <TableCell className="max-w-[360px] lg:max-w-[520px]">
                        <div className="flex items-center gap-3">
                          {attraction.cover_image && (
                            <Image
                              src={attraction.cover_image}
                              alt={attraction.title}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded object-cover"
                              unoptimized={attraction.cover_image.startsWith(
                                "/uploads",
                              )}
                            />
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/attractions/${attraction.slug}/edit`}
                              className="block truncate text-sm text-blue-600 hover:underline"
                              title={attraction.title}
                            >
                              {attraction.title}
                            </Link>
                            <p className="truncate text-xs text-slate-500">
                              /{attraction.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {regions.find((r) => r.id === attraction.region_id)
                          ?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            attraction.status === "published"
                              ? "default"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {attraction.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(
                          attraction.likes ??
                          attraction.like_count ??
                          0
                        ).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(attraction.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
