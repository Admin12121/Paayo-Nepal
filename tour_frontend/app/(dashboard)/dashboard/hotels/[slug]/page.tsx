"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle,
  Plus,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import type {
  CreateHotelInput,
  HotelBranch,
  Region,
} from "@/lib/api-client";
import { regionsApi } from "@/lib/api-client";
import {
  useAddHotelBranchMutation,
  useDeleteHotelMutation,
  useGetHotelBranchesQuery,
  useGetHotelBySlugQuery,
  usePublishHotelMutation,
  useRemoveHotelBranchMutation,
  useUpdateHotelBranchMutation,
  useUpdateHotelMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/utils/toast";

interface BranchFormData {
  id?: string;
  region_id: string;
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
  region_id: "",
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

function parsePhoneNumbers(rawPhone: string | null | undefined): string[] {
  const numbers = (rawPhone ?? "")
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return numbers.length > 0 ? numbers : [""];
}

function parseGalleryImages(rawGallery: unknown): string[] {
  if (!Array.isArray(rawGallery)) return [];
  return rawGallery
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildHotelPayload(data: HotelFormData): CreateHotelInput {
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
}

function normalizeBranches(rows: BranchFormData[]): BranchFormData[] {
  const cleaned = rows
    .map((row) => ({
      ...row,
      region_id: row.region_id.trim(),
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
}

function toBranchFormData(branch: HotelBranch): BranchFormData {
  return {
    id: branch.id,
    region_id: branch.region_id || "",
    name: branch.name,
    address: branch.address || "",
    phone: branch.phone || "",
    email: branch.email || "",
    is_main: branch.is_main,
  };
}

export default function DashboardHotelDetailPage() {
  const params = useParams();
  const router = useRouter();

  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const [formData, setFormData] = useState<HotelFormData>(EMPTY_HOTEL_FORM);
  const [branches, setBranches] = useState<BranchFormData[]>([]);
  const [removedBranchIds, setRemovedBranchIds] = useState<string[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [syncingBranches, setSyncingBranches] = useState(false);
  const [galleryBulkInput, setGalleryBulkInput] = useState("");

  const [initializedMetaHotelId, setInitializedMetaHotelId] = useState<
    string | null
  >(null);
  const [initializedBranchHotelId, setInitializedBranchHotelId] = useState<
    string | null
  >(null);

  const {
    data: hotel,
    isLoading,
    isFetching,
    error,
    refetch: refetchHotel,
  } = useGetHotelBySlugQuery(slug ?? "", {
    skip: !slug,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const {
    data: branchRows = [],
    isLoading: branchesLoading,
    refetch: refetchBranches,
  } = useGetHotelBranchesQuery(hotel?.id ?? "", {
    skip: !hotel?.id,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const [updateHotel, { isLoading: savingMeta }] = useUpdateHotelMutation();
  const [publishHotel, { isLoading: publishing }] = usePublishHotelMutation();
  const [deleteHotel, { isLoading: deleting }] = useDeleteHotelMutation();
  const [addHotelBranch] = useAddHotelBranchMutation();
  const [updateHotelBranch] = useUpdateHotelBranchMutation();
  const [removeHotelBranch] = useRemoveHotelBranchMutation();

  const saving = savingMeta || syncingBranches;

  useEffect(() => {
    let mounted = true;

    const loadRegions = async () => {
      try {
        const response = await regionsApi.list({ limit: 100 });
        if (mounted) {
          setRegions(response.data);
        }
      } catch (loadError) {
        console.error(loadError);
        toast.error("Failed to load regions");
      }
    };

    void loadRegions();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hotel) return;
    if (initializedMetaHotelId === hotel.id) return;

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
    setInitializedMetaHotelId(hotel.id);
  }, [hotel, initializedMetaHotelId]);

  useEffect(() => {
    if (!hotel?.id) return;
    if (branchesLoading) return;
    if (initializedBranchHotelId === hotel.id) return;

    setBranches(branchRows.map(toBranchFormData));
    setInitializedBranchHotelId(hotel.id);
  }, [hotel?.id, branchRows, branchesLoading, initializedBranchHotelId]);

  const stats = useMemo(() => {
    const activeBranches = normalizeBranches(branches);
    return {
      phones: formData.phone_numbers.filter((value) => value.trim()).length,
      galleries: formData.gallery_images.filter((value) => value.trim()).length,
      branches: activeBranches.length,
    };
  }, [branches, formData.gallery_images, formData.phone_numbers]);

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

  const moveGalleryImage = (index: number, direction: "up" | "down") => {
    setFormData((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.gallery_images.length) {
        return prev;
      }

      const next = [...prev.gallery_images];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...prev, gallery_images: next };
    });
  };

  const appendBulkGalleryUrls = () => {
    const candidates = galleryBulkInput
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (candidates.length === 0) {
      toast.error("Paste at least one image URL");
      return;
    }

    let added = 0;
    setFormData((prev) => {
      const existing = new Set(
        prev.gallery_images.map((value) => value.trim()).filter(Boolean),
      );
      const next = [...prev.gallery_images];

      for (const url of candidates) {
        if (existing.has(url)) continue;
        existing.add(url);
        next.push(url);
        added += 1;
      }

      return { ...prev, gallery_images: next };
    });

    if (added === 0) {
      toast.info("No new image URLs to add");
      return;
    }

    setGalleryBulkInput("");
    toast.success(`${added} gallery image${added > 1 ? "s" : ""} added`);
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

  const syncHotelBranches = async (hotelId: string) => {
    for (const branchId of removedBranchIds) {
      await removeHotelBranch({ hotelId, branchId }).unwrap();
    }

    const validBranches = normalizeBranches(branches);
    for (const branch of validBranches) {
      const payload = {
        region_id: branch.region_id || undefined,
        name: branch.name,
        address: branch.address || undefined,
        phone: branch.phone || undefined,
        email: branch.email || undefined,
        is_main: branch.is_main,
      };

      if (branch.id) {
        await updateHotelBranch({
          hotelId,
          branchId: branch.id,
          data: payload,
        }).unwrap();
      } else {
        await addHotelBranch({ hotelId, data: payload }).unwrap();
      }
    }

    setRemovedBranchIds([]);
  };

  const handleSave = async () => {
    if (!hotel) return;
    if (!formData.name.trim()) {
      toast.error("Hotel name is required");
      return;
    }

    try {
      const payload = buildHotelPayload(formData);
      const updatedHotel = await updateHotel({ id: hotel.id, data: payload }).unwrap();
      setSyncingBranches(true);
      await syncHotelBranches(hotel.id);

      if (slug && updatedHotel.slug !== slug) {
        router.replace(`/dashboard/hotels/${updatedHotel.slug}`);
        router.refresh();
        return;
      }

      setInitializedMetaHotelId(null);
      setInitializedBranchHotelId(null);
      await Promise.all([refetchHotel(), refetchBranches()]);
      toast.success("Hotel updated successfully");
    } catch {
      toast.error("Failed to update hotel");
    } finally {
      setSyncingBranches(false);
    }
  };

  const handlePublish = async () => {
    if (!hotel) return;

    try {
      await publishHotel(hotel.id).unwrap();
      await refetchHotel();
      toast.success("Hotel published successfully");
    } catch {
      toast.error("Failed to publish hotel");
    }
  };

  const handleDelete = async () => {
    if (!hotel) return;
    if (!window.confirm(`Delete "${hotel.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteHotel(hotel.id).unwrap();
      toast.success("Hotel deleted successfully");
      router.replace("/dashboard/hotels");
      router.refresh();
    } catch {
      toast.error("Failed to delete hotel");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="space-y-4 rounded-xl border bg-white p-8 text-center">
        <p className="text-slate-700">Hotel not found.</p>
        <div>
          <Link
            href="/dashboard/hotels"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Back to hotels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {isFetching && (
        <div className="h-0.5 overflow-hidden bg-blue-100">
          <div className="h-full w-full animate-pulse bg-blue-500" />
        </div>
      )}

      <section className="rounded-2xl border bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
          <div className="min-w-0">
            <Link
              href="/dashboard/hotels"
              className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Hotels
            </Link>
            <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">
              {formData.name || hotel.name}
            </h1>
            <p className="mt-1 text-xs text-blue-600">/{hotel.slug}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {hotel.status}
            </Badge>
            {hotel.is_featured && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                <Star className="mr-1 h-3 w-3 fill-current" />
                Featured
              </Badge>
            )}
            {hotel.status === "draft" && (
              <Button
                type="button"
                size="sm"
                onClick={handlePublish}
                isLoading={publishing}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Publish
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleSave} isLoading={saving}>
              <Save className="mr-1 h-4 w-4" />
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDelete}
              isLoading={deleting}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Price Range
                </label>
                <select
                  value={formData.price_range || "mid"}
                  onChange={(e) =>
                    setFormData({ ...formData, price_range: e.target.value })
                  }
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="budget">Budget</option>
                  <option value="mid">Mid-range</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Star Rating
                </label>
                <select
                  value={String(formData.star_rating ?? "")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      star_rating: e.target.value
                        ? parseInt(e.target.value, 10)
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <Button type="button" variant="outline" size="sm" onClick={addPhoneField}>
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

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/30 p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Branches & Locations
                </label>
                <Button type="button" variant="outline" size="sm" onClick={addBranchField}>
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
                        <select
                          value={branch.region_id}
                          onChange={(e) =>
                            updateBranchField(index, "region_id", e.target.value)
                          }
                          className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                          <option value="">Branch region (optional)</option>
                          {regions.map((region) => (
                            <option key={region.id} value={region.id}>
                              {region.name}
                            </option>
                          ))}
                        </select>
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
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Quick Paste URLs
                </label>
                <Textarea
                  rows={3}
                  value={galleryBulkInput}
                  onChange={(e) => setGalleryBulkInput(e.target.value)}
                  placeholder="Paste one image URL per line (or comma separated)"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={appendBulkGalleryUrls}
                >
                  Add Pasted URLs
                </Button>
              </div>
              {formData.gallery_images.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Add optional gallery images for the hotel detail page.
                </p>
              ) : (
                <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                  {formData.gallery_images.map((url, index) => (
                    <div
                      key={`gallery-${index}`}
                      className="rounded-md border border-gray-200 bg-white p-2"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
                        <span>Image {index + 1}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => moveGalleryImage(index, "up")}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={index === formData.gallery_images.length - 1}
                            onClick={() => moveGalleryImage(index, "down")}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <ImageUpload
                        label=""
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

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <Textarea
                className="min-h-0 border-gray-300"
                rows={5}
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Hotel description..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="hotel_is_featured_edit"
                checked={formData.is_featured || false}
                onChange={(e) =>
                  setFormData({ ...formData, is_featured: e.target.checked })
                }
              />
              <label htmlFor="hotel_is_featured_edit" className="text-sm text-gray-700">
                Featured
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Phones</p>
                <p className="text-sm font-semibold text-slate-800">{stats.phones}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Branches</p>
                <p className="text-sm font-semibold text-slate-800">{stats.branches}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Gallery</p>
                <p className="text-sm font-semibold text-slate-800">{stats.galleries}</p>
              </div>
            </div>

            <Link
              href={`/hotels/${hotel.slug}`}
              className="inline-flex text-xs text-blue-600 hover:underline"
            >
              View public page
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
