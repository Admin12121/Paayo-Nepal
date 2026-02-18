"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Trash2,
  Upload,
  Eye,
  Calendar,
  User,
} from "lucide-react";
import {
  useGetPhotoBySlugQuery,
  useListPhotoImagesQuery,
  useAddPhotoImageMutation,
  useRemovePhotoImageMutation,
} from "@/lib/store";
import { apiFetch } from "@/lib/csrf";
import { useDashboard } from "@/lib/contexts/DashboardContext";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/utils/toast";

export default function PhotoFeatureUploaderPage() {
  const { userRole } = useDashboard();
  const canUpload = userRole === "admin" || userRole === "editor";

  const params = useParams();
  const slug = params.slug as string;

  const { data: photo, isLoading: photoLoading } = useGetPhotoBySlugQuery(
    slug,
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  const {
    data: images = [],
    isLoading: imagesLoading,
    refetch: refetchImages,
  } = useListPhotoImagesQuery(photo?.id ?? "", {
    skip: !photo?.id,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const [addPhotoImage, { isLoading: addingImage }] =
    useAddPhotoImageMutation();
  const [removePhotoImage, { isLoading: removingImage }] =
    useRemovePhotoImageMutation();

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    imageId: string | null;
  }>({ open: false, imageId: null });

  const fileRef = useRef<HTMLInputElement>(null);

  const sortedImages = useMemo(
    () => [...images].sort((a, b) => a.display_order - b.display_order),
    [images],
  );

  const uploadToMedia = async (selected: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", selected);

    const response = await apiFetch("/api/media", {
      method: "POST",
      body: fd,
    });

    if (!response.ok) {
      throw new Error("Failed to upload image");
    }

    const data = (await response.json()) as { url?: string; filename?: string };
    const url = data.url || (data.filename ? `/uploads/${data.filename}` : "");

    if (!url) {
      throw new Error("Upload did not return image URL");
    }

    return url;
  };

  const handleAddImage = async () => {
    if (!canUpload) {
      toast.error("You don't have permission to upload images");
      return;
    }

    if (!photo?.id || !file) {
      toast.error("Please choose an image file");
      return;
    }

    try {
      setUploading(true);
      const imageUrl = await uploadToMedia(file);

      await addPhotoImage({
        photoId: photo.id,
        data: {
          image_url: imageUrl,
          caption: caption.trim() || undefined,
          display_order: sortedImages.length,
        },
      }).unwrap();

      await refetchImages();
      toast.success("Image uploaded");
      setFile(null);
      setCaption("");
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!canUpload) {
      toast.error("You don't have permission to remove images");
      return;
    }

    if (!photo?.id || !deleteDialog.imageId) {
      return;
    }

    try {
      await removePhotoImage({
        photoId: photo.id,
        imageId: deleteDialog.imageId,
      }).unwrap();

      await refetchImages();
      setDeleteDialog({ open: false, imageId: null });
      toast.success("Image removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove image");
    }
  };

  if (photoLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="p-6 text-center text-gray-500">
        Photo feature not found.
      </div>
    );
  }

  const cover =
    sortedImages[0]?.image_url ||
    "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1600&auto=format&fit=crop";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-slate-900 text-white">
        <img
          src={cover}
          alt={photo.title}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-slate-900/30" />

        <div className="relative z-10 p-6 sm:p-8">
          <Link
            href="/dashboard/photos"
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-200 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Photos
          </Link>

          <h1 className="text-3xl font-bold">{photo.title}</h1>
          <p className="mt-1 text-sm text-slate-200">/{photo.slug}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-white/30 bg-white/10 text-white capitalize"
            >
              {photo.status}
            </Badge>
            {photo.is_featured && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                Featured
              </Badge>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Images</p>
              <p className="mt-1 text-xl font-semibold">
                {sortedImages.length}
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Views</p>
              <p className="mt-1 text-xl font-semibold">
                {photo.view_count.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Created</p>
              <p className="mt-1 text-xl font-semibold">
                {new Date(photo.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Upload Image
        </h2>

        <div className="grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-[1fr_1fr_auto]">
          <Input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
          />
          <Button
            onClick={handleAddImage}
            disabled={!canUpload || !file || uploading || addingImage}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading || addingImage ? "Uploading..." : "Add Image"}
          </Button>
        </div>

        {!canUpload && (
          <p className="mt-2 text-xs text-amber-600">
            Your account is view-only for uploader actions.
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Gallery</h2>

        {imagesLoading ? (
          <LoadingSpinner />
        ) : sortedImages.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-slate-500">
            <Camera className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            No images uploaded yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedImages.map((image) => (
              <article
                key={image.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img
                    src={image.image_url}
                    alt={image.caption || "Photo"}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    #{image.display_order + 1}
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-sm text-slate-800">
                    {image.caption || "No caption"}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <User className="h-3.5 w-3.5" />
                    <span className="truncate">
                      {image.uploaded_by || "unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(image.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={image.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" /> Open
                    </a>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      disabled={!canUpload}
                      onClick={() =>
                        setDeleteDialog({ open: true, imageId: image.id })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, imageId: null })}
        onConfirm={handleDeleteImage}
        title="Remove Image"
        message="Are you sure you want to remove this image?"
        confirmLabel="Remove"
        variant="danger"
        isLoading={removingImage}
      />
    </div>
  );
}
