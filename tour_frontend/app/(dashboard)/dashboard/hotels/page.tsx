"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Hotel,
  Star,
  StarOff,
  CheckCircle,
  GripVertical,
  MoreHorizontal,
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import Link from "next/link";
import {
  type Hotel as HotelType,
  type HotelBranch,
  type CreateHotelInput,
  type Region,
  hotelsApi as hotelsClientApi,
  regionsApi,
} from "@/lib/api-client";
import {
  useListHotelsQuery,
  useCreateHotelMutation,
  useUpdateHotelMutation,
  useDeleteHotelMutation,
  usePublishHotelMutation,
  useUpdateHotelDisplayOrderMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/utils/toast";

const EMPTY_HOTELS: HotelType[] = [];

interface BranchFormData {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  is_main: boolean;
}

interface HotelFormData {
  name: string;
  description: string;
  email: string;
  website: string;
  star_rating?: number;
  price_range: string;
  cover_image: string;
  region_id: string;
  is_featured: boolean;
  phone_numbers: string[];
  gallery_images: string[];
}

const EMPTY_BRANCH: BranchFormData = {
  name: "",
  address: "",
  phone: "",
  email: "",
  is_main: false,
};

const EMPTY_HOTEL_FORM: HotelFormData = {
  name: "",
  description: "",
  email: "",
  website: "",
  star_rating: undefined,
  price_range: "mid",
  cover_image: "",
  region_id: "",
  is_featured: false,
  phone_numbers: [""],
  gallery_images: [],
};

function DraggableHotelRow({
  hotel,
  rankEnabled,
  getPriceLabel,
  getStatusBadge,
  onToggleFeatured,
  onPublish,
  onEdit,
  onDelete,
}: {
  hotel: HotelType;
  rankEnabled: boolean;
  getPriceLabel: (range: string | null) => string;
  getStatusBadge: (status: string) => string;
  onToggleFeatured: (hotel: HotelType) => void;
  onPublish: (hotel: HotelType) => void;
  onEdit: (hotel: HotelType) => void;
  onDelete: (hotel: HotelType) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: hotel.id,
    disabled: !rankEnabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-70" : undefined}
    >
      <TableCell className="max-w-[340px] lg:max-w-[520px]">
        <div className="flex items-center">
          {rankEnabled && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="mr-2 cursor-grab text-slate-400 active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 shrink-0" />
            </button>
          )}
          {hotel.cover_image && (
            <Image
              src={hotel.cover_image}
              alt={hotel.name}
              width={48}
              height={48}
              className="w-12 h-12 object-cover rounded mr-3"
              unoptimized={hotel.cover_image.startsWith("/uploads")}
            />
          )}
          <div className="min-w-0">
            <Link
              href={`/hotels/${hotel.slug}`}
              className="block truncate text-sm font-medium text-gray-900 hover:text-blue-700"
            >
              {hotel.name}
            </Link>
            <Link
              href={`/hotels/${hotel.slug}`}
              className="block truncate text-xs text-blue-600 hover:underline"
            >
              /{hotel.slug}
            </Link>
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
          {hotel.star_rating ? "★".repeat(hotel.star_rating) : "-"}
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
          onClick={() => onToggleFeatured(hotel)}
          className="h-auto p-0 text-gray-400 hover:bg-transparent hover:text-yellow-500"
          title={hotel.is_featured ? "Remove from featured" : "Add to featured"}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/hotels/${hotel.slug}`}>View public page</Link>
            </DropdownMenuItem>
            {hotel.status === "draft" && (
              <DropdownMenuItem onClick={() => onPublish(hotel)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Publish
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(hotel)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(hotel)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function HotelsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [rankingMode, setRankingMode] = useState(false);
  const [orderedHotels, setOrderedHotels] = useState<HotelType[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    hotel: HotelType | null;
  }>({ open: false, hotel: null });
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    hotel: HotelType | null;
  }>({ open: false, hotel: null });
  const [formData, setFormData] = useState<HotelFormData>(EMPTY_HOTEL_FORM);
  const [branches, setBranches] = useState<BranchFormData[]>([]);
  const [removedBranchIds, setRemovedBranchIds] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);

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
  } = useListHotelsQuery(
    {
      page: currentPage,
      limit: 20,
      status: statusFilter !== "all" ? statusFilter : undefined,
      price_range: priceFilter !== "all" ? priceFilter : undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListHotelsQuery` to refetch.
  // No more manual `loadHotels()` calls after every mutation!
  const [createHotel, { isLoading: creating }] = useCreateHotelMutation();
  const [updateHotel, { isLoading: updatingHotel }] = useUpdateHotelMutation();
  const [deleteHotel, { isLoading: deleting }] = useDeleteHotelMutation();
  const [publishHotel] = usePublishHotelMutation();
  const [updateHotelDisplayOrder, { isLoading: savingOrder }] =
    useUpdateHotelDisplayOrderMutation();

  const saving = creating || updatingHotel;

  // ── Derived data ────────────────────────────────────────────────────────
  const hotels = hotelsResponse?.data ?? EMPTY_HOTELS;
  const totalPages = hotelsResponse?.total_pages ?? 1;

  useEffect(() => {
    setOrderedHotels(hotels);
  }, [hotels]);

  useEffect(() => {
    const loadRegions = async () => {
      try {
        const response = await regionsApi.list({ limit: 100 });
        setRegions(response.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load regions");
      }
    };

    loadRegions();
  }, []);

  // Client-side search filter (instant, no network request)
  const filteredHotels = orderedHotels.filter((hotel) =>
    searchQuery
      ? hotel.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );
  const canRankHotels = searchQuery.trim() === "";
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );
  const dataIds = useMemo<UniqueIdentifier[]>(
    () => filteredHotels.map((hotel) => hotel.id),
    [filteredHotels],
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const parsePhoneNumbers = useCallback(
    (rawPhone: string | null | undefined) => {
      const numbers = (rawPhone ?? "")
        .split(/[,;\n]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      return numbers.length > 0 ? numbers : [""];
    },
    [],
  );

  const parseGalleryImages = useCallback((rawGallery: unknown) => {
    if (!Array.isArray(rawGallery)) return [];
    return rawGallery
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }, []);

  const buildHotelPayload = useCallback(
    (data: HotelFormData): CreateHotelInput => {
      const normalizedPhones = data.phone_numbers
        .map((value) => value.trim())
        .filter(Boolean);
      const normalizedGallery = data.gallery_images
        .map((value) => value.trim())
        .filter(Boolean);

      return {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        email: data.email.trim() || undefined,
        phone: normalizedPhones.join(", ") || undefined,
        website: data.website.trim() || undefined,
        star_rating: data.star_rating,
        price_range: data.price_range || undefined,
        cover_image: data.cover_image.trim() || undefined,
        region_id: data.region_id.trim(),
        is_featured: data.is_featured,
        gallery: normalizedGallery.length > 0 ? normalizedGallery : undefined,
      };
    },
    [],
  );

  const normalizeBranches = useCallback((rows: BranchFormData[]) => {
    const cleaned = rows
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        address: row.address.trim(),
        phone: row.phone.trim(),
        email: row.email.trim(),
      }))
      .filter((row) => row.name.length > 0);

    if (cleaned.length === 0) return cleaned;
    if (cleaned.some((row) => row.is_main)) {
      let mainAssigned = false;
      return cleaned.map((row) => {
        const shouldBeMain = row.is_main && !mainAssigned;
        if (shouldBeMain) mainAssigned = true;
        return { ...row, is_main: shouldBeMain };
      });
    }

    return cleaned.map((row, index) => ({ ...row, is_main: index === 0 }));
  }, []);

  const syncHotelBranches = useCallback(
    async (hotelId: string) => {
      for (const branchId of removedBranchIds) {
        await hotelsClientApi.removeBranch(hotelId, branchId);
      }

      const validBranches = normalizeBranches(branches);
      for (const branch of validBranches) {
        const payload = {
          name: branch.name,
          address: branch.address || undefined,
          phone: branch.phone || undefined,
          email: branch.email || undefined,
          is_main: branch.is_main,
        };

        if (branch.id) {
          await hotelsClientApi.updateBranch(hotelId, branch.id, payload);
        } else {
          await hotelsClientApi.addBranch(hotelId, payload);
        }
      }

      setRemovedBranchIds([]);
    },
    [branches, normalizeBranches, removedBranchIds],
  );

  const handlePhoneChange = (index: number, value: string) => {
    setFormData((prev) => {
      const next = [...prev.phone_numbers];
      next[index] = value;
      return { ...prev, phone_numbers: next };
    });
  };

  const addPhoneField = () => {
    setFormData((prev) => ({
      ...prev,
      phone_numbers: [...prev.phone_numbers, ""],
    }));
  };

  const removePhoneField = (index: number) => {
    setFormData((prev) => {
      const next = prev.phone_numbers.filter((_, idx) => idx !== index);
      return {
        ...prev,
        phone_numbers: next.length > 0 ? next : [""],
      };
    });
  };

  const addGalleryImage = () => {
    setFormData((prev) => ({
      ...prev,
      gallery_images: [...prev.gallery_images, ""],
    }));
  };

  const updateGalleryImage = (index: number, url: string) => {
    setFormData((prev) => {
      const next = [...prev.gallery_images];
      next[index] = url;
      return { ...prev, gallery_images: next };
    });
  };

  const removeGalleryImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, idx) => idx !== index),
    }));
  };

  const addBranchField = () => {
    setBranches((prev) => [
      ...prev,
      { ...EMPTY_BRANCH, is_main: prev.length === 0 },
    ]);
  };

  const updateBranchField = (
    index: number,
    field: keyof Omit<BranchFormData, "id">,
    value: string | boolean,
  ) => {
    setBranches((prev) =>
      prev.map((branch, idx) =>
        idx === index ? { ...branch, [field]: value } : branch,
      ),
    );
  };

  const setMainBranch = (index: number) => {
    setBranches((prev) =>
      prev.map((branch, idx) => ({ ...branch, is_main: idx === index })),
    );
  };

  const removeBranchField = (index: number) => {
    const branchToRemove = branches[index];
    if (branchToRemove?.id) {
      setRemovedBranchIds((prev) =>
        prev.includes(branchToRemove.id as string)
          ? prev
          : [...prev, branchToRemove.id as string],
      );
    }

    setBranches((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length > 0 && !next.some((branch) => branch.is_main)) {
        next[0] = { ...next[0], is_main: true };
      }
      return next;
    });
  };

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
      const payload = buildHotelPayload(formData);
      const createdHotel = await createHotel(payload).unwrap();
      await syncHotelBranches(createdHotel.id);
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
      const payload = buildHotelPayload(formData);
      await updateHotel({
        id: editModal.hotel.id,
        data: payload,
      }).unwrap();
      await syncHotelBranches(editModal.hotel.id);
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
      website: hotel.website || "",
      star_rating: hotel.star_rating ?? undefined,
      price_range: hotel.price_range || "mid",
      cover_image: hotel.cover_image || "",
      region_id: hotel.region_id || "",
      is_featured: hotel.is_featured,
      phone_numbers: parsePhoneNumbers(hotel.phone),
      gallery_images: parseGalleryImages(hotel.gallery),
    });
    setRemovedBranchIds([]);
    setEditModal({ open: true, hotel });
    setBranchesLoading(true);

    void (async () => {
      try {
        const branchRows = await hotelsClientApi.getBranches(hotel.id);
        setBranches(
          branchRows.map((branch: HotelBranch) => ({
            id: branch.id,
            name: branch.name,
            address: branch.address || "",
            phone: branch.phone || "",
            email: branch.email || "",
            is_main: branch.is_main,
          })),
        );
      } catch {
        setBranches([]);
        toast.error("Failed to load hotel branches");
      } finally {
        setBranchesLoading(false);
      }
    })();
  };

  const resetForm = () => {
    setFormData({
      ...EMPTY_HOTEL_FORM,
      phone_numbers: [""],
      gallery_images: [],
    });
    setBranches([]);
    setRemovedBranchIds([]);
    setBranchesLoading(false);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!rankingMode || !canRankHotels || !over || active.id === over.id)
      return;
    setOrderedHotels((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    if (!canRankHotels) {
      toast.error("Clear search to reorder.");
      return;
    }
    try {
      const base = (currentPage - 1) * 20;
      const changed = orderedHotels
        .map((hotel, index) => ({ hotel, index }))
        .filter(({ hotel, index }) => hotels[index]?.id !== hotel.id);
      if (changed.length === 0) {
        toast.info("No order changes to save");
        return;
      }
      await Promise.all(
        changed.map(({ hotel, index }) =>
          updateHotelDisplayOrder({
            id: hotel.id,
            display_order: base + index,
          }).unwrap(),
        ),
      );
      toast.success("Hotel order updated");
    } catch (error) {
      toast.error("Failed to update order");
      console.error(error);
    }
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
        return "रु";
      case "mid":
        return "रु रु";
      case "luxury":
        return "रु रु रु";
      default:
        return "-";
    }
  };

  const hotelForm = (
    <div className="space-y-5">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region
          </label>
          <select
            value={formData.region_id || ""}
            onChange={(e) =>
              setFormData({ ...formData, region_id: e.target.value })
            }
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select region...</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Range
          </label>
          <select
            value={formData.price_range || "mid"}
            onChange={(e) =>
              setFormData({ ...formData, price_range: e.target.value })
            }
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="budget">Budget (रु)</option>
            <option value="mid">Mid-range (रु रु)</option>
            <option value="luxury">Luxury (रु रु रु)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Star Rating
          </label>
          <select
            value={String(formData.star_rating ?? "")}
            onChange={(e) =>
              setFormData({
                ...formData,
                star_rating: e.target.value
                  ? parseInt(e.target.value)
                  : undefined,
              })
            }
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">No rating</option>
            <option value="1">1 Star</option>
            <option value="2">2 Stars</option>
            <option value="3">3 Stars</option>
            <option value="4">4 Stars</option>
            <option value="5">5 Stars</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/30 p-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Phone Numbers
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPhoneField}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Phone
          </Button>
        </div>
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
          {formData.phone_numbers.map((phone, index) => (
            <div key={`phone-${index}`} className="flex items-center gap-2">
              <Input
                value={phone}
                onChange={(e) => handlePhoneChange(index, e.target.value)}
                placeholder="+977-..."
              />
              {formData.phone_numbers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePhoneField(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cover Image
        </label>
        <ImageUpload
          label=""
          value={formData.cover_image || ""}
          onChange={(url) => setFormData({ ...formData, cover_image: url })}
          onRemove={() => setFormData({ ...formData, cover_image: "" })}
          previewHeightClass="h-44"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/30 p-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Gallery Images
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addGalleryImage}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Image
          </Button>
        </div>
        {formData.gallery_images.length === 0 ? (
          <p className="text-xs text-gray-500">
            Add optional gallery images for the hotel detail page.
          </p>
        ) : (
          <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {formData.gallery_images.map((url, index) => (
              <div
                key={`gallery-${index}`}
                className="rounded-md border border-gray-200 bg-white p-2"
              >
                <ImageUpload
                  label={`Image ${index + 1}`}
                  value={url}
                  onChange={(nextUrl) => updateGalleryImage(index, nextUrl)}
                  onRemove={() => removeGalleryImage(index)}
                  previewHeightClass="h-32"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/30 p-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Branches & Locations
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBranchField}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Branch
          </Button>
        </div>

        {branchesLoading ? (
          <p className="text-sm text-gray-500">Loading branches...</p>
        ) : branches.length === 0 ? (
          <p className="text-xs text-gray-500">
            No branches added yet. Add at least one if this hotel has multiple
            locations.
          </p>
        ) : (
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {branches.map((branch, index) => (
              <div
                key={branch.id ?? `branch-${index}`}
                className="rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Branch {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBranchField(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={branch.name}
                    onChange={(e) =>
                      updateBranchField(index, "name", e.target.value)
                    }
                    placeholder="Branch name"
                  />
                  <Input
                    value={branch.address}
                    onChange={(e) =>
                      updateBranchField(index, "address", e.target.value)
                    }
                    placeholder="Address"
                  />
                  <Input
                    value={branch.phone}
                    onChange={(e) =>
                      updateBranchField(index, "phone", e.target.value)
                    }
                    placeholder="Phone"
                  />
                  <Input
                    value={branch.email}
                    onChange={(e) =>
                      updateBranchField(index, "email", e.target.value)
                    }
                    placeholder="Email"
                  />
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={branch.is_main}
                    onChange={() => setMainBranch(index)}
                  />
                  Mark as main branch
                </label>
              </div>
            ))}
          </div>
        )}
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
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
                setRankingMode(false);
              }}
              className="h-9 min-w-[150px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <select
              value={priceFilter}
              onChange={(e) => {
                setPriceFilter(e.target.value);
                setCurrentPage(1);
                setRankingMode(false);
              }}
              className="h-9 min-w-[150px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Prices</option>
              <option value="budget">Budget</option>
              <option value="mid">Mid-range</option>
              <option value="luxury">Luxury</option>
            </select>
            <Button
              variant={rankingMode ? "default" : "outline"}
              size="sm"
              disabled={!canRankHotels}
              onClick={() => setRankingMode((prev) => !prev)}
            >
              Rank Mode
            </Button>
            {rankingMode && (
              <Button
                size="sm"
                onClick={handleSaveOrder}
                isLoading={savingOrder}
              >
                Save Order
              </Button>
            )}
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
              <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                sensors={sensors}
                onDragEnd={handleDragEnd}
              >
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
                    <SortableContext
                      items={dataIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredHotels.map((hotel) => (
                        <DraggableHotelRow
                          key={hotel.id}
                          hotel={hotel}
                          rankEnabled={rankingMode && canRankHotels}
                          getPriceLabel={getPriceLabel}
                          getStatusBadge={getStatusBadge}
                          onToggleFeatured={handleToggleFeatured}
                          onPublish={handlePublish}
                          onEdit={openEditModal}
                          onDelete={(item) =>
                            setDeleteDialog({ open: true, hotel: item })
                          }
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
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
        size="xl"
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
        size="xl"
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
