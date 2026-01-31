"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, MapPin, Eye } from "lucide-react";
import { regionsApi, Region } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRegions();
  }, [currentPage, provinceFilter]);

  const loadRegions = async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit: 20 };
      if (provinceFilter !== "all") params.province = provinceFilter;

      const response = await regionsApi.list(params);
      setRegions(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error("Failed to load regions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.region) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/regions/${deleteDialog.region.slug}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete region");
      toast.success("Region deleted successfully");
      setDeleteDialog({ open: false, region: null });
      loadRegions();
    } catch (error) {
      toast.error("Failed to delete region");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredRegions = regions.filter((region) =>
    searchQuery
      ? region.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

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

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4">
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
            onChange={(e) => setProvinceFilter(e.target.value)}
            options={[
              { value: "all", label: "All Provinces" },
              ...PROVINCES.map((p) => ({ value: p, label: p })),
            ]}
            className="min-w-[150px]"
          />
        </div>

        {loading ? (
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
                    {region.featured_image && (
                      <img
                        src={region.featured_image}
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
                            {region.province && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {region.province}
                                {region.district && `, ${region.district}`}
                              </div>
                            )}
                            {region.latitude && region.longitude && (
                              <div>
                                Coordinates: {region.latitude.toFixed(4)},{" "}
                                {region.longitude.toFixed(4)}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Display Order: {region.display_order}
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
