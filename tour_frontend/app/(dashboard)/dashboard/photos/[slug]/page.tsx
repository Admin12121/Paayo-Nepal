"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/animated-link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Save,
  Send,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import type {
  CreatePhotoFeatureInput,
  PhotoImage,
  Region,
} from "@/lib/api-client";
import { regionsApi } from "@/lib/api-client";
import { apiFetch } from "@/lib/csrf";
import { useDashboard } from "@/lib/contexts/DashboardContext";
import {
  useAddPhotoImageMutation,
  useDeletePhotoMutation,
  useGetPhotoBySlugQuery,
  useListPhotoImagesQuery,
  usePublishPhotoMutation,
  useRemovePhotoImageMutation,
  useUpdatePhotoMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/Textarea";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { toast } from "@/lib/utils/toast";

const EMPTY_FORM: CreatePhotoFeatureInput = {
  title: "",
  description: "",
  region_id: "",
  is_featured: false,
};

export default function DashboardPhotoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userRole } = useDashboard();
  const canManagePhotoMeta = userRole === "admin";
  const canUploadPhotoImages = userRole === "admin" || userRole === "editor";

  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const [hydratedPhotoId, setHydratedPhotoId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreatePhotoFeatureInput>(EMPTY_FORM);
  const [regions, setRegions] = useState<Region[]>([]);
  const [newImageCaption, setNewImageCaption] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    data: photo,
    isLoading,
    isFetching,
    error,
    refetch: refetchPhoto,
  } = useGetPhotoBySlugQuery(slug ?? "", {
    skip: !slug,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const {
    data: images = [],
    isLoading: imagesLoading,
    refetch: refetchImages,
  } = useListPhotoImagesQuery(photo?.id ?? "", {
    skip: !photo?.id,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const [updatePhoto, { isLoading: savingMeta }] = useUpdatePhotoMutation();
  const [publishPhoto, { isLoading: publishing }] = usePublishPhotoMutation();
  const [deletePhoto, { isLoading: deleting }] = useDeletePhotoMutation();
  const [addPhotoImage, { isLoading: addingImage }] = useAddPhotoImageMutation();
  const [removePhotoImage, { isLoading: removingImage }] =
    useRemovePhotoImageMutation();

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
    if (!photo) return;
    if (hydratedPhotoId === photo.id) return;

    setFormData({
      title: photo.title,
      description: photo.description ?? "",
      region_id: photo.region_id ?? "",
      is_featured: photo.is_featured,
    });
    setHydratedPhotoId(photo.id);
  }, [photo, hydratedPhotoId]);

  const sortedImages = useMemo(
    () => [...images].sort((a, b) => a.display_order - b.display_order),
    [images],
  );

  const handleSave = async () => {
    if (!photo) return;
    if (!canManagePhotoMeta) {
      toast.error("Only admins can edit photo details");
      return;
    }
    if (!formData.title?.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      const updatedPhoto = await updatePhoto({
        id: photo.id,
        data: {
          title: formData.title.trim(),
          description: formData.description || "",
          region_id: formData.region_id || "",
          is_featured: !!formData.is_featured,
        },
      }).unwrap();

      if (slug && updatedPhoto.slug !== slug) {
        router.replace(`/dashboard/photos/${updatedPhoto.slug}`);
        router.refresh();
        return;
      }

      toast.success("Photo feature updated");
      await refetchPhoto();
    } catch {
      toast.error("Failed to update photo feature");
    }
  };

  const handlePublish = async () => {
    if (!photo) return;
    if (!canManagePhotoMeta) {
      toast.error("Only admins can publish photo features");
      return;
    }

    try {
      await publishPhoto(photo.id).unwrap();
      toast.success("Photo feature published");
      await refetchPhoto();
    } catch {
      toast.error("Failed to publish photo feature");
    }
  };

  const handleDelete = async () => {
    if (!photo) return;
    if (!canManagePhotoMeta) {
      toast.error("Only admins can delete photo features");
      return;
    }
    if (!window.confirm(`Delete "${photo.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deletePhoto(photo.id).unwrap();
      toast.success("Photo feature deleted");
      router.replace("/dashboard/photos");
      router.refresh();
    } catch {
      toast.error("Failed to delete photo feature");
    }
  };

  const handleAddImage = async () => {
    if (!canUploadPhotoImages) {
      toast.error("You don't have permission to upload images");
      return;
    }
    if (!photo || !newImageFile) {
      toast.error("Image file is required");
      return;
    }

    try {
      setUploadingImage(true);

      const fd = new FormData();
      fd.append("file", newImageFile);

      const uploadResponse = await apiFetch("/api/media", {
        method: "POST",
        body: fd,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      const uploadData = (await uploadResponse.json()) as {
        url?: string;
        filename?: string;
      };

      const imageUrl =
        uploadData.url ||
        (uploadData.filename ? `/uploads/${uploadData.filename}` : "");

      if (!imageUrl) {
        throw new Error("Upload did not return an image URL");
      }

      await addPhotoImage({
        photoId: photo.id,
        data: {
          image_url: imageUrl,
          caption: newImageCaption.trim() || undefined,
          display_order: images.length,
        },
      }).unwrap();

      await Promise.all([refetchImages(), refetchPhoto()]);
      toast.success("Image added");

      setNewImageCaption("");
      setNewImageFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    } catch {
      toast.error("Failed to add image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (image: PhotoImage) => {
    if (!canUploadPhotoImages) {
      toast.error("You don't have permission to remove images");
      return;
    }
    if (!photo) return;
    if (!window.confirm("Are you sure you want to remove this image?")) return;

    try {
      await removePhotoImage({
        photoId: photo.id,
        imageId: image.id,
      }).unwrap();

      await Promise.all([refetchImages(), refetchPhoto()]);
      toast.success("Image removed");
    } catch {
      toast.error("Failed to remove image");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !photo) {
    return (
      <div className="space-y-4 rounded-xl border bg-white p-8 text-center">
        <p className="text-slate-700">Photo feature not found.</p>
        <div>
          <Link
            href="/dashboard/photos"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Back to photo features
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
              href="/dashboard/photos"
              className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Photo Features
            </Link>
            <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">
              {formData.title || photo.title}
            </h1>
            <p className="mt-1 text-xs text-blue-600">/{photo.slug}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {photo.status}
            </Badge>
            {photo.is_featured ? (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                <Star className="mr-1 h-3 w-3 fill-current" />
                Featured
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600">
                <StarOff className="mr-1 h-3 w-3" />
                Standard
              </Badge>
            )}
            {photo.status === "draft" && canManagePhotoMeta && (
              <Button
                type="button"
                onClick={handlePublish}
                isLoading={publishing}
                size="sm"
              >
                <Send className="mr-1 h-4 w-4" />
                Publish
              </Button>
            )}
            {canManagePhotoMeta && (
              <Button
                type="button"
                onClick={handleSave}
                isLoading={savingMeta}
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-700"
              >
                <Save className="mr-1 h-4 w-4" />
                Save
              </Button>
            )}
            {canManagePhotoMeta && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                isLoading={deleting}
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title *
              </label>
              <Input
                value={formData.title}
                disabled={!canManagePhotoMeta}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g. Kathmandu Valley"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </label>
              <Textarea
                rows={5}
                value={formData.description || ""}
                disabled={!canManagePhotoMeta}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description for this gallery"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Region
              </label>
              <select
                value={formData.region_id || ""}
                disabled={!canManagePhotoMeta}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    region_id: e.target.value,
                  }))
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

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!formData.is_featured}
                disabled={!canManagePhotoMeta}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_featured: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border border-slate-300"
              />
              Featured collection
            </label>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Views</p>
                <p className="text-sm font-semibold text-slate-800">
                  <NumberTicker
                    value={photo.view_count ?? 0}
                    className="tracking-normal text-current dark:text-current"
                  />
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Images</p>
                <p className="text-sm font-semibold text-slate-800">
                  {sortedImages.length}
                </p>
              </div>
            </div>

            <Link
              href={`/photos?search=${encodeURIComponent(photo.title)}`}
              className="inline-flex text-xs text-blue-600 hover:underline"
            >
              View public page
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Gallery Images</h2>
          <p className="text-sm text-slate-500">{sortedImages.length} total</p>
        </div>

        <div className="mb-5 rounded-lg border border-dashed p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Add New Image</h3>
          <div className="space-y-3">
            <Input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
            />
            <Input
              value={newImageCaption}
              onChange={(e) => setNewImageCaption(e.target.value)}
              placeholder="Caption (optional)"
            />
            <Button
              onClick={handleAddImage}
              disabled={addingImage || uploadingImage || !newImageFile}
              size="sm"
            >
              <ImagePlus className="mr-1 h-4 w-4" />
              {addingImage || uploadingImage ? "Uploading..." : "Add Image"}
            </Button>
          </div>
        </div>

        {imagesLoading ? (
          <LoadingSpinner />
        ) : sortedImages.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-slate-500">
            <Camera className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            No images yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sortedImages.map((image) => (
              <div
                key={image.id}
                className="group relative overflow-hidden rounded-lg border"
              >
                <div className="aspect-square bg-slate-100">
                  <img
                    src={image.image_url}
                    alt={image.caption || "Photo"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs text-slate-700">
                    {image.caption || "No caption"}
                  </p>
                </div>
                <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  #{image.display_order + 1}
                </div>
                {canUploadPhotoImages && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDeleteImage(image)}
                    disabled={removingImage}
                    className="absolute right-2 top-2 h-7 rounded-full bg-black/50 px-2 text-white opacity-0 transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
