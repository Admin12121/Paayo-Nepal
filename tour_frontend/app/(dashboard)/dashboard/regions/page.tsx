"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import type { Region } from "@/lib/api-client";
import { useListRegionsQuery, useDeleteRegionMutation } from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

const PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

export default function RegionsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    region: Region | null;
  }>({
    open: false,
    region: null,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  const {
    data: regionsResponse,
    isLoading,
    isFetching,
  } = useListRegionsQuery({
    page: currentPage,
    limit: 20,
    province: provinceFilter !== "all" ? provinceFilter : undefined,
  });

  const [deleteRegion, { isLoading: deleting }] = useDeleteRegionMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const regions = regionsResponse?.data ?? [];
  const totalPages = regionsResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredRegions = regions.filter((region) =>
    searchQuery
      ? region.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.region) return;

    try {
      await deleteRegion(deleteDialog.region.slug).unwrap();
      toast.success("Region deleted successfully");
      setDeleteDialog({ open: false, region: null });
    } catch (error) {
      toast.error("Failed to delete region");
      console.error(error);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regions</h1>
          <p className="text-gray-600 mt-1">
            Manage tourism regions and destinations
          </p>
        </div>
        <Link href="/dashboard/regions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Region
          </Button>
        </Link>
      </div>

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search regions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={provinceFilter}
            onChange={(e) => {
              setProvinceFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Provinces" },
              ...PROVINCES.map((p) => ({ value: p, label: p })),
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
        ) : filteredRegions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No regions found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {filteredRegions.map((region) => (
                <div
                  key={region.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {region.cover_image && (
                      <img
                        src={region.cover_image}
                        alt={region.name}
                        className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {region.name}
                          </h3>
                          {region.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {region.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${region.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                            >
                              {region.status}
                            </span>
                            {region.is_featured && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Attraction Rank: {region.attraction_rank || 0}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link href={`/dashboard/regions/${region.slug}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, region })
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
        onClose={() => setDeleteDialog({ open: false, region: null })}
        onConfirm={handleDelete}
        title="Delete Region"
        message={`Are you sure you want to delete "${deleteDialog.region?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
