"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, MapPin, Star, Eye } from "lucide-react";
import {
  attractionsApi,
  Attraction,
  regionsApi,
  Region,
} from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/utils/toast";

export default function AttractionsPage() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [topFilter, setTopFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    attraction: Attraction | null;
  }>({
    open: false,
    attraction: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    loadAttractions();
  }, [currentPage, regionFilter, topFilter]);

  const loadRegions = async () => {
    try {
      const response = await regionsApi.list({ limit: 100 });
      setRegions(response.data);
    } catch (error) {
      console.error("Failed to load regions:", error);
    }
  };

  const loadAttractions = async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit: 20 };
      if (regionFilter !== "all") params.region_id = regionFilter;
      if (topFilter === "top") params.is_top = true;

      const response = await attractionsApi.list(params);
      setAttractions(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error("Failed to load attractions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.attraction) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/attractions/${deleteDialog.attraction.slug}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete attraction");
      toast.success("Attraction deleted successfully");
      setDeleteDialog({ open: false, attraction: null });
      loadAttractions();
    } catch (error) {
      toast.error("Failed to delete attraction");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredAttractions = attractions.filter((attraction) =>
    searchQuery
      ? attraction.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

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

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4">
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
            onChange={(e) => setRegionFilter(e.target.value)}
            options={[
              { value: "all", label: "All Regions" },
              ...regions.map((r) => ({ value: r.id, label: r.name })),
            ]}
            className="min-w-[150px]"
          />
          <Select
            value={topFilter}
            onChange={(e) => setTopFilter(e.target.value)}
            options={[
              { value: "all", label: "All Attractions" },
              { value: "top", label: "Top Attractions" },
            ]}
            className="min-w-[150px]"
          />
        </div>

        {loading ? (
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
                    {attraction.featured_image && (
                      <img
                        src={attraction.featured_image}
                        alt={attraction.name}
                        className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {attraction.name}
                          </h3>
                          {attraction.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {attraction.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            {attraction.address && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {attraction.address}
                              </div>
                            )}
                            {attraction.rating && (
                              <div className="flex items-center">
                                <Star className="w-4 h-4 mr-1 text-yellow-500" />
                                {attraction.rating.toFixed(1)} (
                                {attraction.review_count} reviews)
                              </div>
                            )}
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {attraction.views} views
                            </div>
                          </div>
                          <div className="mt-2">
                            {attraction.is_top_attraction && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Star className="w-3 h-3 mr-1" />
                                Top Attraction
                              </span>
                            )}
                            {attraction.entry_fee && (
                              <span className="ml-2 text-xs text-gray-600">
                                Entry: {attraction.entry_fee}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, attraction: null })}
        onConfirm={handleDelete}
        title="Delete Attraction"
        message={`Are you sure you want to delete "${deleteDialog.attraction?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
