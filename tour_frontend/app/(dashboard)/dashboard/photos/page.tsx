"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Camera,
  ImagePlus,
  GripVertical,
  MoreHorizontal,
  Images,
  Eye,
  Calendar,
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
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import type {
  PhotoFeature,
  PhotoImage,
  CreatePhotoFeatureInput,
  Region,
} from "@/lib/api-client";
import { photoFeaturesApi, regionsApi } from "@/lib/api-client";
import {
  useListPhotosQuery,
  useCreatePhotoMutation,
  useUpdatePhotoMutation,
  useDeletePhotoMutation,
  usePublishPhotoMutation,
  useListPhotoImagesQuery,
  useAddPhotoImageMutation,
  useRemovePhotoImageMutation,
  useUpdatePhotoDisplayOrderMutation,
} from "@/lib/store";
import { apiFetch } from "@/lib/csrf";
import { useDashboard } from "@/lib/contexts/DashboardContext";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/Textarea";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/utils/toast";

const EMPTY_PHOTOS: PhotoFeature[] = [];
const PHOTO_VIEW_MODE_STORAGE_KEY = "dashboard:photos:view-mode";

function pickDeterministicImage(
  photoId: string,
  urls: Array<string | null | undefined>,
): string | null {
  const imageCandidates = urls.filter((url): url is string => !!url);
  if (imageCandidates.length === 0) return null;

  const seed = Array.from(photoId).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return imageCandidates[seed % imageCandidates.length];
}

function resolvePhotoImageCount(
  photo: PhotoFeature,
  imageCounts: Record<string, number>,
): number {
  return (
    imageCounts[photo.id] ?? photo.image_count ?? photo.images?.length ?? 0
  );
}

function resolvePhotoCover(
  photo: PhotoFeature,
  coverMap: Record<string, string | null>,
): string | null {
  const cached = coverMap[photo.id];
  if (cached) return cached;
  if (photo.cover_image_url) return photo.cover_image_url;
  return pickDeterministicImage(
    photo.id,
    (photo.images ?? []).map((img) => img.image_url),
  );
}

function SortablePhotoCard({
  photo,
  imageCount,
  coverImageUrl,
  rankingMode,
  canManagePhotoMeta,
  onOpenImages,
  onToggleFeatured,
  onPublish,
  onEdit,
  onDelete,
}: {
  photo: PhotoFeature;
  imageCount: number;
  coverImageUrl: string | null;
  rankingMode: boolean;
  canManagePhotoMeta: boolean;
  onOpenImages: (photo: PhotoFeature) => void;
  onToggleFeatured: (photo: PhotoFeature) => void;
  onPublish: (photo: PhotoFeature) => void;
  onEdit: (photo: PhotoFeature) => void;
  onDelete: (photo: PhotoFeature) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: photo.id,
    disabled: !rankingMode || !canManagePhotoMeta,
  });

  const cover =
    coverImageUrl ??
    pickDeterministicImage(
      photo.id,
      (photo.images ?? []).map((img) => img.image_url),
    );

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`group relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
        isDragging ? "opacity-75" : ""
      }`}
    >
      {!rankingMode && (
        <button
          type="button"
          onClick={() => onOpenImages(photo)}
          className="absolute inset-0 z-10"
          aria-label={`Manage images for ${photo.title}`}
        />
      )}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {cover ? (
          <img
            src={cover}
            alt={photo.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-600 p-4 text-center">
            <p className="line-clamp-3 text-sm font-semibold text-white">
              {photo.title}
            </p>
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge
            variant="outline"
            className={`border-white/30 bg-black/60 text-white capitalize ${
              photo.status === "published" ? "" : "opacity-90"
            }`}
          >
            {photo.status}
          </Badge>
          {photo.is_featured && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
              Featured
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {rankingMode && canManagePhotoMeta && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="rounded-md border border-white/20 bg-black/50 p-1.5 text-white"
              title="Drag to reorder"
              aria-label="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-20 h-8 w-8 border border-white/20 bg-black/50 text-white hover:bg-black/70 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onOpenImages(photo)}>
                Manage images
              </DropdownMenuItem>
              {canManagePhotoMeta && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(photo)}>
                    Edit details
                  </DropdownMenuItem>
                  {photo.status === "draft" && (
                    <DropdownMenuItem onClick={() => onPublish(photo)}>
                      Publish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onToggleFeatured(photo)}>
                    {photo.is_featured ? "Unfeature" : "Feature"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(photo)}
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900">
            {photo.title}
          </h3>
          <p className="line-clamp-1 text-xs text-slate-500">/{photo.slug}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
          <div className="rounded-md bg-slate-50 p-2">
            <div className="mb-1 flex items-center gap-1 font-medium text-slate-800">
              <Images className="h-3.5 w-3.5" /> Images
            </div>
            <p>{imageCount}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <div className="mb-1 flex items-center gap-1 font-medium text-slate-800">
              <Eye className="h-3.5 w-3.5" /> Views
            </div>
            <p>{photo.view_count.toLocaleString()}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <div className="mb-1 flex items-center gap-1 font-medium text-slate-800">
              <Calendar className="h-3.5 w-3.5" /> Date
            </div>
            <p>{new Date(photo.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function SortablePhotoRow({
  photo,
  imageCount,
  rankEnabled,
  canManagePhotoMeta,
  onOpenImages,
  onToggleFeatured,
  onPublish,
  onEdit,
  onDelete,
}: {
  photo: PhotoFeature;
  imageCount: number;
  rankEnabled: boolean;
  canManagePhotoMeta: boolean;
  onOpenImages: (photo: PhotoFeature) => void;
  onToggleFeatured: (photo: PhotoFeature) => void;
  onPublish: (photo: PhotoFeature) => void;
  onEdit: (photo: PhotoFeature) => void;
  onDelete: (photo: PhotoFeature) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: photo.id,
    disabled: !rankEnabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-70" : undefined}
    >
      <TableCell className="max-w-[360px] lg:max-w-[520px]">
        <div className="flex items-center gap-2">
          {rankEnabled && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab text-slate-400 active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpenImages(photo)}
              className="block truncate text-left text-sm text-blue-600 hover:underline"
            >
              {photo.title}
            </button>
            <p className="truncate text-xs text-slate-500">/{photo.slug}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenImages(photo)}
          className="h-auto px-0 text-blue-600 hover:bg-transparent hover:text-blue-800"
        >
          <Camera className="mr-1 h-4 w-4" />
          {imageCount} images
        </Button>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {photo.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {photo.view_count.toLocaleString()}
      </TableCell>
      <TableCell className="text-slate-600">
        {new Date(photo.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpenImages(photo)}>
              Manage images
            </DropdownMenuItem>
            {canManagePhotoMeta && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(photo)}>
                  Edit details
                </DropdownMenuItem>
                {photo.status === "draft" && (
                  <DropdownMenuItem onClick={() => onPublish(photo)}>
                    Publish
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onToggleFeatured(photo)}>
                  {photo.is_featured ? "Unfeature" : "Feature"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(photo)}
                >
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function PhotoFeaturesPage() {
  const { userRole } = useDashboard();
  const canManagePhotoMeta = userRole === "admin";
  const canUploadPhotoImages = userRole === "admin" || userRole === "editor";

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "cards";
    const saved = window.localStorage.getItem(PHOTO_VIEW_MODE_STORAGE_KEY);
    return saved === "table" ? "table" : "cards";
  });
  const [rankingMode, setRankingMode] = useState(false);
  const [orderedPhotos, setOrderedPhotos] = useState<PhotoFeature[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    photo: PhotoFeature | null;
  }>({ open: false, photo: null });

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    photo: PhotoFeature | null;
  }>({ open: false, photo: null });
  const [imagesModal, setImagesModal] = useState<{
    open: boolean;
    photo: PhotoFeature | null;
  }>({ open: false, photo: null });

  const [formData, setFormData] = useState<CreatePhotoFeatureInput>({
    title: "",
    description: "",
    region_id: "",
    is_featured: false,
  });

  const [newImageCaption, setNewImageCaption] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});
  const [photoCoverImages, setPhotoCoverImages] = useState<
    Record<string, string | null>
  >({});
  const hydratedPhotoMetaRef = useRef<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    data: photosResponse,
    isLoading,
    isFetching,
    refetch: refetchPhotos,
  } = useListPhotosQuery(
    {
      page: currentPage,
      limit: 20,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  const [createPhoto, { isLoading: creating }] = useCreatePhotoMutation();
  const [updatePhoto, { isLoading: updatingPhoto }] = useUpdatePhotoMutation();
  const [deletePhoto, { isLoading: deleting }] = useDeletePhotoMutation();
  const [publishPhoto] = usePublishPhotoMutation();
  const [updatePhotoDisplayOrder, { isLoading: savingOrder }] =
    useUpdatePhotoDisplayOrderMutation();
  const [addPhotoImage, { isLoading: addingImage }] =
    useAddPhotoImageMutation();
  const [removePhotoImage] = useRemovePhotoImageMutation();

  const {
    data: images = [],
    isLoading: imagesLoading,
    refetch: refetchImages,
  } = useListPhotoImagesQuery(imagesModal.photo?.id ?? "", {
    skip: !imagesModal.open || !imagesModal.photo?.id,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  useEffect(() => {
    const photoId = imagesModal.photo?.id;
    if (!imagesModal.open || !photoId) return;
    const cover = pickDeterministicImage(
      photoId,
      images.map((image) => image.image_url),
    );

    setImageCounts((prev) => {
      if (prev[photoId] === images.length) return prev;
      return { ...prev, [photoId]: images.length };
    });
    setPhotoCoverImages((prev) => {
      if (prev[photoId] === cover) return prev;
      return { ...prev, [photoId]: cover };
    });
  }, [images, imagesModal.open, imagesModal.photo?.id]);

  const photos = photosResponse?.data ?? EMPTY_PHOTOS;
  const totalPages = photosResponse?.total_pages ?? 1;

  const refreshPhotoMeta = useCallback(
    async (photo: PhotoFeature) => {
      try {
        const photoImages = await photoFeaturesApi.listImages(photo.id);
        const cover = pickDeterministicImage(
          photo.id,
          photoImages.map((img) => img.image_url),
        );
        setImageCounts((prev) => {
          if (prev[photo.id] === photoImages.length) return prev;
          return { ...prev, [photo.id]: photoImages.length };
        });
        setPhotoCoverImages((prev) => {
          if (prev[photo.id] === cover) return prev;
          return { ...prev, [photo.id]: cover };
        });
      } catch {
        const fallbackCover =
          photo.cover_image_url ??
          pickDeterministicImage(
            photo.id,
            (photo.images ?? []).map((img) => img.image_url),
          );
        const fallbackCount = photo.image_count ?? photo.images?.length ?? 0;
        setImageCounts((prev) => ({
          ...prev,
          [photo.id]: prev[photo.id] ?? fallbackCount,
        }));
        setPhotoCoverImages((prev) => ({
          ...prev,
          [photo.id]: prev[photo.id] ?? fallbackCover,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    setOrderedPhotos(photos);
  }, [photos]);

  useEffect(() => {
    window.localStorage.setItem(PHOTO_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

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

  useEffect(() => {
    if (photos.length === 0) return;
    let cancelled = false;

    const loadCounts = async () => {
      const currentPhotoIds = new Set(photos.map((photo) => photo.id));
      hydratedPhotoMetaRef.current.forEach((id) => {
        if (!currentPhotoIds.has(id)) {
          hydratedPhotoMetaRef.current.delete(id);
        }
      });

      // Seed from list payload metadata first (when available).
      setImageCounts((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const photo of photos) {
          if (photo.image_count == null) continue;
          if (next[photo.id] === undefined) {
            next[photo.id] = photo.image_count;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setPhotoCoverImages((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const photo of photos) {
          const coverFromPayload =
            photo.cover_image_url ??
            pickDeterministicImage(
              photo.id,
              (photo.images ?? []).map((img) => img.image_url),
            );
          if (next[photo.id] === undefined) {
            next[photo.id] = coverFromPayload;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      const uncachedPhotos = photos.filter(
        (photo) =>
          !hydratedPhotoMetaRef.current.has(photo.id) &&
          (photo.image_count == null || photo.image_count === 0),
      );

      if (uncachedPhotos.length === 0) return;

      const pairs = await Promise.all(
        uncachedPhotos.map(async (photo) => {
          try {
            const photoImages = await photoFeaturesApi.listImages(photo.id);
            return {
              id: photo.id,
              count: photoImages.length,
              cover: pickDeterministicImage(
                photo.id,
                photoImages.map((img) => img.image_url),
              ),
            } as const;
          } catch {
            return {
              id: photo.id,
              count: photo.image_count ?? photo.images?.length ?? 0,
              cover:
                photo.cover_image_url ??
                pickDeterministicImage(
                  photo.id,
                  (photo.images ?? []).map((img) => img.image_url),
                ),
            } as const;
          }
        }),
      );

      if (cancelled) return;

      setImageCounts((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const { id, count } of pairs) {
          if (next[id] !== count) {
            next[id] = count;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setPhotoCoverImages((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const { id, cover } of pairs) {
          if (next[id] !== cover) {
            next[id] = cover;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      for (const { id } of pairs) {
        hydratedPhotoMetaRef.current.add(id);
      }
      for (const photo of photos) {
        if (photo.image_count != null && photo.image_count > 0) {
          hydratedPhotoMetaRef.current.add(photo.id);
        }
      }
    };

    void loadCounts();

    return () => {
      cancelled = true;
    };
  }, [photos]);

  const filteredPhotos = useMemo(
    () =>
      orderedPhotos.filter((photo) => {
        const matchesSearch =
          searchQuery.trim() === "" ||
          photo.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || photo.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [orderedPhotos, searchQuery, statusFilter],
  );

  const totalImages = filteredPhotos.reduce(
    (sum, photo) => sum + resolvePhotoImageCount(photo, imageCounts),
    0,
  );

  const canRankPhotos = statusFilter === "all" && searchQuery.trim() === "";

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const dataIds = useMemo<UniqueIdentifier[]>(
    () => filteredPhotos.map((photo) => photo.id),
    [filteredPhotos],
  );

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      region_id: "",
      is_featured: false,
    });
  };

  const handleDelete = async () => {
    if (!deleteDialog.photo) return;
    try {
      await deletePhoto(deleteDialog.photo.id).unwrap();
      await refetchPhotos();
      toast.success("Photo feature deleted");
      setDeleteDialog({ open: false, photo: null });
    } catch {
      toast.error("Failed to delete photo feature");
    }
  };

  const handlePublish = async (photo: PhotoFeature) => {
    if (!canManagePhotoMeta) {
      toast.error("Only admins can publish photo features");
      return;
    }
    try {
      await publishPhoto(photo.id).unwrap();
      await refetchPhotos();
      toast.success("Photo feature published");
    } catch {
      toast.error("Failed to publish photo feature");
    }
  };

  const handleToggleFeatured = async (photo: PhotoFeature) => {
    if (!canManagePhotoMeta) {
      toast.error("Only admins can change featured status");
      return;
    }

    try {
      await updatePhoto({
        id: photo.id,
        data: { is_featured: !photo.is_featured },
      }).unwrap();
      await refetchPhotos();
      toast.success(
        photo.is_featured ? "Removed from featured" : "Marked as featured",
      );
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleCreate = async () => {
    if (!canManagePhotoMeta) {
      toast.error("Only admins can create photo features");
      return;
    }
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      await createPhoto({
        ...formData,
        region_id: formData.region_id || undefined,
      }).unwrap();
      await refetchPhotos();
      toast.success("Photo feature created");
      setCreateModal(false);
      resetForm();
    } catch {
      toast.error("Failed to create photo feature");
    }
  };

  const handleUpdate = async () => {
    if (!canManagePhotoMeta || !editModal.photo) {
      return;
    }

    try {
      await updatePhoto({
        id: editModal.photo.id,
        data: {
          ...formData,
          region_id: formData.region_id,
        },
      }).unwrap();
      await refetchPhotos();
      toast.success("Photo feature updated");
      setEditModal({ open: false, photo: null });
      resetForm();
    } catch {
      toast.error("Failed to update photo feature");
    }
  };

  const openEditModal = (photo: PhotoFeature) => {
    setFormData({
      title: photo.title,
      description: photo.description || "",
      region_id: photo.region_id || "",
      is_featured: photo.is_featured,
    });
    setEditModal({ open: true, photo });
  };

  const openImagesModal = (photo: PhotoFeature) => {
    const fallbackCover = resolvePhotoCover(photo, photoCoverImages);
    const fallbackCount = resolvePhotoImageCount(photo, imageCounts);

    setImageCounts((prev) => {
      if (prev[photo.id] !== undefined) return prev;
      return { ...prev, [photo.id]: fallbackCount };
    });
    setPhotoCoverImages((prev) => {
      if (prev[photo.id] !== undefined) return prev;
      return { ...prev, [photo.id]: fallbackCover };
    });
    setImagesModal({ open: true, photo });
    void refreshPhotoMeta(photo);
  };

  const handleAddImage = async () => {
    if (!canUploadPhotoImages) {
      toast.error("You don't have permission to upload images");
      return;
    }
    if (!imagesModal.photo || !newImageFile) {
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
        photoId: imagesModal.photo.id,
        data: {
          image_url: imageUrl,
          caption: newImageCaption.trim() || undefined,
          display_order: images.length,
        },
      }).unwrap();

      await refetchPhotos();
      await refetchImages();
      await refreshPhotoMeta(imagesModal.photo);
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
    if (!imagesModal.photo) return;
    if (!window.confirm("Are you sure you want to remove this image?")) return;

    try {
      await removePhotoImage({
        photoId: imagesModal.photo.id,
        imageId: image.id,
      }).unwrap();
      await refetchPhotos();
      await refetchImages();
      await refreshPhotoMeta(imagesModal.photo);
      toast.success("Image removed");
    } catch {
      toast.error("Failed to remove image");
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!rankingMode || !canManagePhotoMeta || !over || active.id === over.id) {
      return;
    }

    setOrderedPhotos((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    if (!canManagePhotoMeta) {
      toast.error("Only admins can save ranking");
      return;
    }
    if (!canRankPhotos) {
      toast.error("Clear search and use All Status to reorder");
      return;
    }

    try {
      const base = (currentPage - 1) * 20;
      const changed = orderedPhotos
        .map((photo, index) => ({ photo, index }))
        .filter(({ photo, index }) => photos[index]?.id !== photo.id);

      if (changed.length === 0) {
        toast.info("No order changes to save");
        return;
      }

      await Promise.all(
        changed.map(({ photo, index }) =>
          updatePhotoDisplayOrder({
            id: photo.id,
            display_order: base + index,
          }).unwrap(),
        ),
      );

      await refetchPhotos();
      toast.success("Photo feature order updated");
    } catch {
      toast.error("Failed to update order");
    }
  };

  const formBody = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Title *
        </label>
        <Input
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          placeholder="e.g. Kathmandu Valley"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Region
        </label>
        <select
          value={formData.region_id || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, region_id: e.target.value }))
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
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Description
        </label>
        <Textarea
          className="min-h-0 border-gray-300"
          rows={4}
          value={formData.description || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Brief description for this gallery"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!formData.is_featured}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, is_featured: e.target.checked }))
          }
          className="h-4 w-4 rounded border border-slate-300"
        />
        Featured collection
      </label>
    </div>
  );

  const heroImage = useMemo(() => {
    const candidates = filteredPhotos
      .map((photo) => resolvePhotoCover(photo, photoCoverImages))
      .filter((url): url is string => !!url);
    if (candidates.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }, [filteredPhotos, photoCoverImages]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-slate-900 text-white">
        {heroImage ? (
          <img
            src={heroImage}
            alt="Photo cover"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-slate-900/30" />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Photo Features</h1>
              <p className="mt-1 text-sm text-slate-200">
                Curate galleries, upload media, and control publishing in one
                place.
              </p>
            </div>
            {canManagePhotoMeta && (
              <Button
                onClick={() => {
                  resetForm();
                  setCreateModal(true);
                }}
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Photo Feature
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Collections</p>
              <p className="mt-1 text-xl font-semibold">
                {filteredPhotos.length}
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Total Images</p>
              <p className="mt-1 text-xl font-semibold">{totalImages}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Featured</p>
              <p className="mt-1 text-xl font-semibold">
                {filteredPhotos.filter((p) => p.is_featured).length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) {
                setRankingMode(false);
              }
            }}
            placeholder="Search collections..."
            className="max-w-[300px]"
          />

          <div className="flex flex-row flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                const value = e.target.value;
                if (value === statusFilter) return;
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
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as "cards" | "table")}
              className="h-9 min-w-[140px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="cards">Cards View</option>
              <option value="table">Table View</option>
            </select>

            <Button
              variant={rankingMode ? "default" : "outline"}
              size="sm"
              disabled={!canManagePhotoMeta || !canRankPhotos}
              onClick={() => setRankingMode((prev) => !prev)}
            >
              Rank Mode
            </Button>
            {rankingMode && canManagePhotoMeta && (
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
      </div>

      {isFetching && !isLoading && (
        <div className="h-0.5 overflow-hidden bg-blue-100">
          <div className="h-full w-full animate-pulse bg-blue-500" />
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">
          <Camera className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p>No photo features found.</p>
        </div>
      ) : viewMode === "cards" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={dataIds} strategy={rectSortingStrategy}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPhotos.map((photo) => (
                <SortablePhotoCard
                  key={photo.id}
                  photo={photo}
                  imageCount={resolvePhotoImageCount(photo, imageCounts)}
                  coverImageUrl={resolvePhotoCover(photo, photoCoverImages)}
                  rankingMode={rankingMode && canRankPhotos}
                  canManagePhotoMeta={canManagePhotoMeta}
                  onOpenImages={openImagesModal}
                  onToggleFeatured={handleToggleFeatured}
                  onPublish={handlePublish}
                  onEdit={openEditModal}
                  onDelete={(item) =>
                    setDeleteDialog({ open: true, photo: item })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
                    <TableHead className="w-[44%]">Title</TableHead>
                    <TableHead className="w-[14%]">Images</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[8%] text-right">Views</TableHead>
                    <TableHead className="w-[12%]">Date</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredPhotos.map((photo) => (
                      <SortablePhotoRow
                        key={photo.id}
                        photo={photo}
                        imageCount={resolvePhotoImageCount(photo, imageCounts)}
                        rankEnabled={rankingMode && canRankPhotos}
                        canManagePhotoMeta={canManagePhotoMeta}
                        onOpenImages={openImagesModal}
                        onToggleFeatured={handleToggleFeatured}
                        onPublish={handlePublish}
                        onEdit={openEditModal}
                        onDelete={(item) =>
                          setDeleteDialog({ open: true, photo: item })
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
        <div className="rounded-xl border bg-white p-3">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create New Photo Feature"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={creating || updatingPhoto}
            >
              Create
            </Button>
          </div>
        }
      >
        {formBody}
      </Modal>

      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, photo: null })}
        title="Edit Photo Feature"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditModal({ open: false, photo: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              isLoading={creating || updatingPhoto}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        {formBody}
      </Modal>

      <Modal
        isOpen={imagesModal.open}
        onClose={() => {
          setImagesModal({ open: false, photo: null });
          setNewImageCaption("");
          setNewImageFile(null);
          if (imageInputRef.current) {
            imageInputRef.current.value = "";
          }
        }}
        title={`Images - ${imagesModal.photo?.title || ""}`}
        size="lg"
        footer={
          <Button
            variant="ghost"
            onClick={() => {
              setImagesModal({ open: false, photo: null });
            }}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-dashed p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-800">
              Add New Image
            </h4>
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
          ) : images.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-slate-500">
              <Camera className="mx-auto mb-2 h-10 w-10 text-slate-300" />
              No images yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[...images]
                .sort((a, b) => a.display_order - b.display_order)
                .map((image) => (
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteImage(image)}
                      className="absolute right-2 top-2 h-7 rounded-full bg-black/50 px-2 text-white opacity-0 transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, photo: null })}
        onConfirm={handleDelete}
        title="Delete Photo Feature"
        message={`Are you sure you want to delete "${deleteDialog.photo?.title}"? This will remove related images too.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
