"use client";

import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Hotel,
  Star,
  StarOff,
  CheckCircle,
} from "lucide-react";
import Image from "next/image";
import type { Hotel as HotelType, CreateHotelInput } from "@/lib/api-client";
import {
  useListHotelsQuery,
  useCreateHotelMutation,
  useUpdateHotelMutation,
  useDeleteHotelMutation,
  usePublishHotelMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/utils/toast";

export default function HotelsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    hotel: HotelType | null;
  }>({ open: false, hotel: null });
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    hotel: HotelType | null;
  }>({ open: false, hotel: null });
  const [formData, setFormData] = useState<CreateHotelInput>({
    name: "",
    description: "",
    email: "",
    phone: "",
    website: "",
    star_rating: undefined,
    price_range: "mid",
    cover_image: "",
    region_id: "",
    is_featured: false,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListHotelsQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadHotels()` pattern!
  const {
    data: hotelsResponse,
    isLoading,
    isFetching,
  } = useListHotelsQuery({
    page: currentPage,
    limit: 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
    price_range: priceFilter !== "all" ? priceFilter : undefined,
  });

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListHotelsQuery` to refetch.
  // No more manual `loadHotels()` calls after every mutation!
  const [createHotel, { isLoading: creating }] = useCreateHotelMutation();
  const [updateHotel, { isLoading: updatingHotel }] = useUpdateHotelMutation();
  const [deleteHotel, { isLoading: deleting }] = useDeleteHotelMutation();
  const [publishHotel] = usePublishHotelMutation();

  const saving = creating || updatingHotel;

  // ── Derived data ────────────────────────────────────────────────────────
  const hotels = hotelsResponse?.data ?? [];
  const totalPages = hotelsResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredHotels = hotels.filter((hotel) =>
    searchQuery
      ? hotel.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.hotel) return;

    try {
      await deleteHotel(deleteDialog.hotel.id).unwrap();
      toast.success("Hotel deleted successfully");
      setDeleteDialog({ open: false, hotel: null });
    } catch {
      toast.error("Failed to delete hotel");
    }
  };

  const handlePublish = async (hotel: HotelType) => {
    try {
      await publishHotel(hotel.id).unwrap();
      toast.success("Hotel published successfully");
    } catch {
      toast.error("Failed to publish hotel");
    }
  };

  const handleToggleFeatured = async (hotel: HotelType) => {
    try {
      await updateHotel({
        id: hotel.id,
        data: { is_featured: !hotel.is_featured },
      }).unwrap();
      toast.success(
        hotel.is_featured ? "Removed from featured" : "Added to featured",
      );
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Hotel name is required");
      return;
    }

    try {
      await createHotel(formData).unwrap();
      toast.success("Hotel created successfully");
      setCreateModal(false);
      resetForm();
    } catch {
      toast.error("Failed to create hotel");
    }
  };

  const handleUpdate = async () => {
    if (!editModal.hotel) return;

    try {
      await updateHotel({
        id: editModal.hotel.id,
        data: formData,
      }).unwrap();
      toast.success("Hotel updated successfully");
      setEditModal({ open: false, hotel: null });
      resetForm();
    } catch {
      toast.error("Failed to update hotel");
    }
  };

  const openEditModal = (hotel: HotelType) => {
    setFormData({
      name: hotel.name,
      description: hotel.description || "",
      email: hotel.email || "",
      phone: hotel.phone || "",
      website: hotel.website || "",
      star_rating: hotel.star_rating ?? undefined,
      price_range: hotel.price_range || "mid",
      cover_image: hotel.cover_image || "",
      region_id: hotel.region_id || "",
      is_featured: hotel.is_featured,
    });
    setEditModal({ open: true, hotel });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      email: "",
      phone: "",
      website: "",
      star_rating: undefined,
      price_range: "mid",
      cover_image: "",
      region_id: "",
      is_featured: false,
    });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-blue-100 text-blue-800",
    };
    return styles[status] || styles.draft;
  };

  const getPriceLabel = (range: string | null) => {
    switch (range) {
      case "budget":
        return "$";
      case "mid":
        return "$$";
      case "luxury":
        return "$$$";
      default:
        return "—";
    }
  };

  const hotelForm = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Hotel Name *
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Hotel name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Range
          </label>
          <Select
            value={formData.price_range || "mid"}
            onChange={(e) =>
              setFormData({ ...formData, price_range: e.target.value })
            }
            options={[
              { value: "budget", label: "Budget ($)" },
              { value: "mid", label: "Mid-range ($$)" },
              { value: "luxury", label: "Luxury ($$$)" },
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Star Rating
          </label>
          <Select
            value={String(formData.star_rating ?? "")}
            onChange={(e) =>
              setFormData({
                ...formData,
                star_rating: e.target.value
                  ? parseInt(e.target.value)
                  : undefined,
              })
            }
            options={[
              { value: "", label: "No rating" },
              { value: "1", label: "1 Star" },
              { value: "2", label: "2 Stars" },
              { value: "3", label: "3 Stars" },
              { value: "4", label: "4 Stars" },
              { value: "5", label: "5 Stars" },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <Input
            type="email"
            value={formData.email || ""}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="hotel@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <Input
            value={formData.phone || ""}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="+977-..."
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Website
        </label>
        <Input
          value={formData.website || ""}
          onChange={(e) =>
            setFormData({ ...formData, website: e.target.value })
          }
          placeholder="https://..."
        />
      </div>
      <div>
        <ImageUpload
          label="Cover Image"
          value={formData.cover_image || ""}
          onChange={(url) => setFormData({ ...formData, cover_image: url })}
          onRemove={() => setFormData({ ...formData, cover_image: "" })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <Textarea
          className="min-h-0 border-gray-300"
          rows={3}
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Hotel description..."
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="hotel_is_featured"
          checked={formData.is_featured || false}
          onChange={(e) =>
            setFormData({ ...formData, is_featured: e.target.checked })
          }
        />
        <label htmlFor="hotel_is_featured" className="text-sm text-gray-700">
          Featured
        </label>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hotels</h1>
          <p className="text-gray-600 mt-1">Manage hotel listings</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Hotel
        </Button>
      </div>

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search hotels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3 ">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Status" },
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ]}
              className="min-w-[150px]"
            />
            <Select
              value={priceFilter}
              onChange={(e) => {
                setPriceFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Prices" },
                { value: "budget", label: "Budget" },
                { value: "mid", label: "Mid-range" },
                { value: "luxury", label: "Luxury" },
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
        ) : filteredHotels.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Hotel className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No hotels found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[34%]">Hotel</TableHead>
                    <TableHead className="w-[8%]">Price</TableHead>
                    <TableHead className="w-[9%]">Rating</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[9%]">Featured</TableHead>
                    <TableHead className="w-[9%] text-right">Views</TableHead>
                    <TableHead className="w-[11%]">Date</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHotels.map((hotel) => (
                    <TableRow key={hotel.id}>
                      <TableCell className="max-w-[340px] lg:max-w-[520px]">
                        <div className="flex items-center">
                          {hotel.cover_image && (
                            <Image
                              src={hotel.cover_image}
                              alt={hotel.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 object-cover rounded mr-3"
                              unoptimized={hotel.cover_image.startsWith(
                                "/uploads",
                              )}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {hotel.name}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              /{hotel.slug}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm font-semibold text-green-700">
                          {getPriceLabel(hotel.price_range)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm text-yellow-600">
                          {hotel.star_rating
                            ? "★".repeat(hotel.star_rating)
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(hotel.status)}`}
                        >
                          {hotel.status}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFeatured(hotel)}
                          className="h-auto p-0 text-gray-400 hover:bg-transparent hover:text-yellow-500"
                          title={
                            hotel.is_featured
                              ? "Remove from featured"
                              : "Add to featured"
                          }
                        >
                          {hotel.is_featured ? (
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff className="w-5 h-5" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-600">
                        {hotel.view_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">
                        {new Date(hotel.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hotel.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublish(hotel)}
                              title="Publish"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(hotel)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, hotel })
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

      {/* Create Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create New Hotel"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Hotel"}
            </Button>
          </div>
        }
      >
        {hotelForm}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, hotel: null })}
        title="Edit Hotel"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditModal({ open: false, hotel: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        {hotelForm}
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, hotel: null })}
        onConfirm={handleDelete}
        title="Delete Hotel"
        message={`Are you sure you want to delete "${deleteDialog.hotel?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
