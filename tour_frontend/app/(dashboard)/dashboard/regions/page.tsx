"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import type { Region } from "@/lib/api-client";
import { useListRegionsQuery, useDeleteRegionMutation } from "@/lib/store";
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

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search regions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3 ">
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
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[44%]">Region</TableHead>
                    <TableHead className="w-[14%]">Province</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[8%] text-right">Rank</TableHead>
                    <TableHead className="w-[12%]">Created</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegions.map((region) => (
                    <TableRow key={region.id}>
                      <TableCell className="max-w-[360px] lg:max-w-[520px]">
                        <div className="flex items-center gap-3">
                          {region.cover_image && (
                            <img
                              src={region.cover_image}
                              alt={region.name}
                              className="h-12 w-12 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/regions/${region.slug}/edit`}
                              className="block truncate text-sm text-blue-600 hover:underline"
                              title={region.name}
                            >
                              {region.name}
                            </Link>
                            <p className="truncate text-xs text-slate-500">
                              /{region.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {region.province || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            region.status === "active" ? "default" : "outline"
                          }
                          className="capitalize"
                        >
                          {region.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(region.attraction_rank || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(region.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
