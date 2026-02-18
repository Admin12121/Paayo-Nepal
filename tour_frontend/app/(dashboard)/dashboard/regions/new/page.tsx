"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Save, Send, Sparkles, X } from "lucide-react";
import { apiFetch } from "@/lib/csrf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Textarea from "@/components/ui/Textarea";
import RegionLocationSettings from "@/components/dashboard/RegionLocationSettings";
import { toast } from "@/lib/utils/toast";
import { baseApi, useAppDispatch } from "@/lib/store";
import {
  buildRegionMapPayload,
  deriveCoordinatesFromRegionLocation,
  type RegionMapMode,
} from "@/lib/region-location";

export default function NewRegionPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cover_image: "",
    is_featured: false,
    province: "",
    district: "",
    map_mode: "districts" as RegionMapMode,
    selected_districts: [] as string[],
    marker: null as [number, number] | null,
    polygon: [] as [number, number][],
  });

  const uploadToMedia = useCallback(async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);

    const response = await apiFetch("/api/media", {
      method: "POST",
      body: fd,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = (await response.json()) as { url?: string; filename?: string };
    const url = data.url || (data.filename ? `/uploads/${data.filename}` : "");
    if (!url) throw new Error("No file URL returned");
    return url;
  }, []);

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const handleCoverFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be less than 20MB");
      return;
    }

    setCoverUploading(true);
    try {
      const url = await uploadToMedia(file);
      setFormData((prev) => ({ ...prev, cover_image: url }));
    } catch {
      toast.error("Failed to upload cover image");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCoverFile(file);
  };

  const handleCoverInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCoverFile(file);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      descriptionRef.current?.focus();
    }
  };

  const autoResizeTitle = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      resizeTextarea(textarea);
      setFormData((prev) => ({ ...prev, name: textarea.value }));
    },
    [resizeTextarea],
  );

  const handleSubmit = async (publish = false) => {
    if (!formData.name.trim()) {
      toast.error("Region name is required");
      titleRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const locationPayload = buildRegionMapPayload({
        mapMode: formData.map_mode,
        selectedDistricts: formData.selected_districts,
        marker: formData.marker,
        polygon: formData.polygon,
      });
      const derivedCoordinates = deriveCoordinatesFromRegionLocation(
        formData.marker,
        formData.polygon,
      );

      const createResponse = await apiFetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          cover_image: formData.cover_image || null,
          is_featured: formData.is_featured,
          province: formData.province || null,
          district: formData.selected_districts[0] || formData.district || null,
          latitude: derivedCoordinates.latitude,
          longitude: derivedCoordinates.longitude,
          map_data: locationPayload,
        }),
      });

      if (!createResponse.ok) {
        throw new Error("Failed to create region");
      }

      const created = (await createResponse.json()) as { slug: string };

      if (publish) {
        const publishResponse = await apiFetch(`/api/regions/${created.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });

        if (!publishResponse.ok) {
          throw new Error("Region created but publish failed");
        }

        toast.success("Region published successfully");
      } else {
        toast.success("Region saved as draft");
      }

      dispatch(
        baseApi.util.invalidateTags([
          { type: "Region", id: "LIST" },
          { type: "DashboardStats" },
        ]),
      );

      router.replace(`/dashboard/regions?refresh=${Date.now()}`);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save region";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[calc(100svh-4rem)] overflow-hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/regions"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Regions</span>
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <span className="text-sm text-gray-400">
            {formData.name || "Untitled"}
          </span>

          {formData.name && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="h-auto gap-1.5 border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Draft
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="h-auto gap-1.5 bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-white" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publish
          </Button>
        </div>
      </div>

      <div className="scrollbar-hide flex h-[calc(100svh-8rem)] overflow-y-auto overflow-x-hidden">
        <div className="flex-1">
          {formData.cover_image ? (
            <div className="group relative">
              <div className="relative h-[280px] w-full overflow-hidden sm:h-[340px]">
                <Image
                  src={formData.cover_image}
                  alt="Cover"
                  fill
                  className="object-cover"
                  sizes="100vw"
                  unoptimized={formData.cover_image.startsWith("/uploads")}
                  priority
                />
              </div>
              <div className="absolute inset-0 flex items-start justify-end gap-2 bg-black/0 p-2 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => coverInputRef.current?.click()}
                  className="h-auto bg-white/90 px-4 py-2 text-sm font-medium text-gray-800 shadow-lg backdrop-blur-sm hover:bg-white"
                >
                  Change cover
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, cover_image: "" }))
                  }
                  className="h-auto bg-red-500/90 p-2 text-white shadow-lg backdrop-blur-sm hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`group relative cursor-pointer transition-colors ${
                coverDragActive ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setCoverDragActive(true);
              }}
              onDragLeave={() => setCoverDragActive(false)}
              onDrop={handleCoverDrop}
              onClick={() => coverInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 transition-colors group-hover:text-gray-500">
                {coverUploading ? (
                  <>
                    <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                    <span className="text-sm">Uploading...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="mb-2 h-8 w-8 stroke-[1.5]" />
                    <span className="text-sm font-medium">
                      Add a cover image
                    </span>
                    <span className="mt-0.5 text-xs text-gray-300">
                      Drag & drop or click to browse
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <Input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverInputChange}
            className="hidden"
          />

          <div className="mx-auto max-w-[720px] px-6 py-10 sm:px-12 lg:px-16">
            <Textarea
              ref={titleRef}
              value={formData.name}
              onChange={autoResizeTitle}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled region"
              className="mb-2 text-5xl! w-full min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-[2.5rem] font-bold leading-tight text-gray-900 placeholder-gray-200 shadow-none focus-visible:ring-0"
              rows={1}
              style={{ minHeight: "3.5rem" }}
            />

            <Textarea
              ref={descriptionRef}
              value={formData.description}
              onChange={(e) => {
                const target = e.target;
                resizeTextarea(target);
                setFormData((prev) => ({ ...prev, description: target.value }));
              }}
              placeholder="Describe this region..."
              className="mb-8 w-full min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-lg leading-relaxed text-gray-500 placeholder-gray-200 shadow-none focus-visible:ring-0"
              rows={4}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                resizeTextarea(target);
              }}
            />

            <Separator className="mb-6 bg-gray-100" />
            <p className="text-sm leading-7 text-gray-500">
              Add a clear region overview, major highlights, and travel context.
              This text is used on listings and detail previews.
            </p>
          </div>
        </div>

        <div
          className="w-[360px] shrink-0 border-l border-gray-200/80 bg-gray-50/70"
        >
          <div className="scrollbar-hide sticky top-[45px] h-[calc(100svh-4rem-45px)] w-[360px] overflow-y-auto">
            <div className="p-5">
              <h3 className="mb-5 text-[13px] font-semibold text-gray-900">
                Region Settings
              </h3>

              <RegionLocationSettings
                province={formData.province}
                onProvinceChange={(value) =>
                  setFormData((prev) => ({ ...prev, province: value }))
                }
                selectedDistricts={formData.selected_districts}
                onSelectedDistrictsChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    selected_districts: value,
                    district: value[0] || "",
                  }))
                }
                mapMode={formData.map_mode}
                onMapModeChange={(value) =>
                  setFormData((prev) => ({ ...prev, map_mode: value }))
                }
                marker={formData.marker}
                onMarkerChange={(value) =>
                  setFormData((prev) => ({ ...prev, marker: value }))
                }
                polygon={formData.polygon}
                onPolygonChange={(value) =>
                  setFormData((prev) => ({ ...prev, polygon: value }))
                }
              />

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Visibility
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      is_featured: !prev.is_featured,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    formData.is_featured
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {formData.is_featured ? "Featured region" : "Regular region"}
                </button>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  Featured regions are highlighted on the website.
                </p>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-gray-400">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  <div>
                    <p>
                      Use high-quality cover photos to improve region cards and
                      hero previews.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
