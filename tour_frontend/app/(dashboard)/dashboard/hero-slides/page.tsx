"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Edit,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  photoFeaturesApi,
  postsApi,
  type CreateHeroSlideInput,
  type HeroSlide,
  videosApi,
} from "@/lib/api-client";
import {
  useCreateHeroSlideMutation,
  useDeleteHeroSlideMutation,
  useGetHeroSlideCountsQuery,
  useListAllHeroSlidesQuery,
  useReorderHeroSlidesMutation,
  useToggleHeroSlideActiveMutation,
  useUpdateHeroSlideMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DashboardCard from "@/components/dashboard/DashboardCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/lib/utils/toast";

type LinkedContentType = "post" | "photo" | "video";

interface ContentOption {
  id: string;
  title: string;
}

function isLinkedType(value: string): value is LinkedContentType {
  return value === "post" || value === "photo" || value === "video";
}

function getSlideSortOrder(slide: HeroSlide): number {
  const withCompat = slide as HeroSlide & {
    sort_order?: number | null;
    display_order?: number | null;
  };
  return withCompat.sort_order ?? withCompat.display_order ?? 0;
}

function getSlideDescription(slide: HeroSlide): string | null {
  const withCompat = slide as HeroSlide & {
    custom_description?: string | null;
    custom_subtitle?: string | null;
  };
  return withCompat.custom_description ?? withCompat.custom_subtitle ?? null;
}

function formatPostType(type: string | null | undefined): string {
  switch ((type || "").toLowerCase()) {
    case "event":
      return "Event";
    case "activity":
      return "Activity";
    case "explore":
    case "attraction":
      return "Attraction";
    default:
      return "Article";
  }
}

export default function HeroSlidesPage() {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    slide: HeroSlide | null;
  }>({ open: false, slide: null });
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    slide: HeroSlide | null;
  }>({ open: false, slide: null });
  const [formData, setFormData] = useState<CreateHeroSlideInput>({
    content_type: "custom",
    content_id: "",
    custom_title: "",
    custom_description: "",
    custom_image: "",
    custom_link: "",
    sort_order: 0,
    is_active: true,
  });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [contentOptions, setContentOptions] = useState<
    Record<LinkedContentType, ContentOption[]>
  >({
    post: [],
    photo: [],
    video: [],
  });

  const {
    data: rawSlides,
    isLoading,
    isFetching,
  } = useListAllHeroSlidesQuery();
  const { data: counts } = useGetHeroSlideCountsQuery();

  const [createHeroSlide, { isLoading: creating }] =
    useCreateHeroSlideMutation();
  const [updateHeroSlide, { isLoading: updatingSlide }] =
    useUpdateHeroSlideMutation();
  const [deleteHeroSlide, { isLoading: deleting }] =
    useDeleteHeroSlideMutation();
  const [toggleHeroSlideActive] = useToggleHeroSlideActiveMutation();
  const [reorderHeroSlides, { isLoading: reordering }] =
    useReorderHeroSlidesMutation();

  const saving = creating || updatingSlide;
  const slides = useMemo(
    () =>
      rawSlides
        ? [...rawSlides].sort(
            (a, b) => getSlideSortOrder(a) - getSlideSortOrder(b),
          )
        : [],
    [rawSlides],
  );
  const slideCounts = counts ?? { total: 0, active: 0, inactive: 0 };

  const currentContentOptions = useMemo(() => {
    if (!isLinkedType(formData.content_type)) return [];
    return contentOptions[formData.content_type];
  }, [contentOptions, formData.content_type]);

  useEffect(() => {
    const loadContentOptions = async () => {
      try {
        setOptionsLoading(true);
        const [postsRes, photosRes, videosRes] = await Promise.all([
          postsApi.list({ limit: 200, status: "published" }),
          photoFeaturesApi.list({ limit: 200, status: "published" }),
          videosApi.list({ limit: 200, status: "published" }),
        ]);

        setContentOptions({
          post: postsRes.data.map((item) => ({
            id: item.id,
            title: `[${formatPostType(item.post_type)}] ${item.title}`,
          })),
          photo: photosRes.data.map((item) => ({
            id: item.id,
            title: item.title,
          })),
          video: videosRes.data.map((item) => ({
            id: item.id,
            title: item.title,
          })),
        });
      } catch (error) {
        console.error(error);
        toast.error("Failed to load content options");
      } finally {
        setOptionsLoading(false);
      }
    };

    void loadContentOptions();
  }, []);

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case "post":
        return "Post";
      case "video":
        return "Video";
      case "photo":
        return "Photo";
      case "custom":
        return "Custom";
      default:
        return type;
    }
  };

  const getContentTypeBadgeColor = (type: string) => {
    switch (type) {
      case "post":
        return "bg-blue-100 text-blue-700";
      case "video":
        return "bg-purple-100 text-purple-700";
      case "photo":
        return "bg-green-100 text-green-700";
      case "custom":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getLinkedContentTitle = (
    contentType: string,
    contentId: string | null | undefined,
  ) => {
    if (!contentId || !isLinkedType(contentType)) return null;
    return (
      contentOptions[contentType].find((item) => item.id === contentId)?.title ??
      null
    );
  };

  const resetForm = () => {
    setFormData({
      content_type: "custom",
      content_id: "",
      custom_title: "",
      custom_description: "",
      custom_image: "",
      custom_link: "",
      sort_order: slides.length,
      is_active: true,
    });
  };

  const openEditModal = (slide: HeroSlide) => {
    setFormData({
      content_type: slide.content_type,
      content_id: slide.content_id || "",
      custom_title: slide.custom_title || "",
      custom_description: getSlideDescription(slide) || "",
      custom_image: slide.custom_image || "",
      custom_link: slide.custom_link || "",
      sort_order: getSlideSortOrder(slide),
      is_active: slide.is_active,
    });
    setEditModal({ open: true, slide });
  };

  const handleDelete = async () => {
    if (!deleteDialog.slide) return;

    try {
      await deleteHeroSlide(deleteDialog.slide.id).unwrap();
      toast.success("Hero slide deleted");
      setDeleteDialog({ open: false, slide: null });
    } catch {
      toast.error("Failed to delete hero slide");
    }
  };

  const handleToggleActive = async (slide: HeroSlide) => {
    try {
      await toggleHeroSlideActive(slide.id).unwrap();
      toast.success(slide.is_active ? "Slide deactivated" : "Slide activated");
    } catch {
      toast.error("Failed to toggle slide status");
    }
  };

  const handleCreate = async () => {
    if (formData.content_type === "custom" && !formData.custom_title?.trim()) {
      toast.error("Title is required for custom slides");
      return;
    }

    if (formData.content_type !== "custom" && !formData.content_id?.trim()) {
      toast.error("Select linked content for this slide");
      return;
    }

    try {
      await createHeroSlide({
        ...formData,
        sort_order: formData.sort_order ?? slides.length,
      }).unwrap();
      toast.success("Hero slide created");
      setCreateModal(false);
      resetForm();
    } catch {
      toast.error("Failed to create hero slide");
    }
  };

  const handleUpdate = async () => {
    if (!editModal.slide) return;

    if (formData.content_type !== "custom" && !formData.content_id?.trim()) {
      toast.error("Select linked content for this slide");
      return;
    }

    try {
      await updateHeroSlide({
        id: editModal.slide.id,
        data: formData,
      }).unwrap();
      toast.success("Hero slide updated");
      setEditModal({ open: false, slide: null });
      resetForm();
    } catch {
      toast.error("Failed to update hero slide");
    }
  };

  const saveOrder = async (orderedSlides: HeroSlide[]) => {
    try {
      const orders = orderedSlides.map((slide, index) => ({
        id: slide.id,
        sort_order: index,
      }));
      await reorderHeroSlides(orders).unwrap();
      toast.success("Slide order updated");
    } catch {
      toast.error("Failed to reorder slides");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const reordered = [...slides];
    [reordered[index - 1], reordered[index]] = [
      reordered[index],
      reordered[index - 1],
    ];
    await saveOrder(reordered);
  };

  const handleMoveDown = async (index: number) => {
    if (index === slides.length - 1) return;
    const reordered = [...slides];
    [reordered[index], reordered[index + 1]] = [
      reordered[index + 1],
      reordered[index],
    ];
    await saveOrder(reordered);
  };

  const slideForm = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Content Type *
        </label>
        <Select
          value={formData.content_type}
          onChange={(e) =>
            setFormData({
              ...formData,
              content_type: e.target.value,
              content_id: "",
            })
          }
          options={[
            { value: "custom", label: "Custom (manual title/image)" },
            { value: "post", label: "Link to Post/Event/Activity/Attraction" },
            { value: "video", label: "Link to Video" },
            { value: "photo", label: "Link to Photo Story" },
          ]}
        />
      </div>

      {formData.content_type !== "custom" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Linked Content *
          </label>
          <Select
            value={formData.content_id || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                content_id: e.target.value,
              })
            }
            options={[
              {
                value: "",
                label: optionsLoading
                  ? "Loading content..."
                  : `Select ${getContentTypeLabel(formData.content_type).toLowerCase()}...`,
              },
              ...currentContentOptions.map((item) => ({
                value: item.id,
                label: item.title,
              })),
            ]}
          />
          <p className="mt-1 text-xs text-gray-500">
            Choose from published content. You can mix types in any order.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {formData.content_type === "custom"
            ? "Title *"
            : "Custom Title (override)"}
        </label>
        <Input
          value={formData.custom_title || ""}
          onChange={(e) =>
            setFormData({ ...formData, custom_title: e.target.value })
          }
          placeholder="Slide title"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {formData.content_type === "custom"
            ? "Description"
            : "Custom Description (override)"}
        </label>
        <Textarea
          className="min-h-0 border-gray-300"
          rows={2}
          value={formData.custom_description || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              custom_description: e.target.value,
            })
          }
          placeholder="Slide subtitle or description"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {formData.content_type === "custom"
            ? "Image URL"
            : "Custom Image URL (override)"}
        </label>
        <Input
          value={formData.custom_image || ""}
          onChange={(e) =>
            setFormData({ ...formData, custom_image: e.target.value })
          }
          placeholder="https://..."
        />
        {formData.custom_image && (
          <div className="relative mt-2 h-32 w-full overflow-hidden rounded-lg bg-gray-100">
            <img
              src={formData.custom_image}
              alt="Preview"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {formData.content_type === "custom"
            ? "Link URL"
            : "Custom Link URL (override)"}
        </label>
        <Input
          value={formData.custom_link || ""}
          onChange={(e) =>
            setFormData({ ...formData, custom_link: e.target.value })
          }
          placeholder="/articles/my-article or https://..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Sort Order
          </label>
          <Input
            type="number"
            value={formData.sort_order ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                sort_order: parseInt(e.target.value, 10) || 0,
              })
            }
            placeholder="0"
          />
        </div>
        <div className="flex items-end">
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="slide_is_active"
              checked={formData.is_active ?? true}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
            />
            <label htmlFor="slide_is_active" className="text-sm text-gray-700">
              Active (visible on homepage)
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hero Slides</h1>
          <p className="mt-1 text-gray-600">Manage the homepage hero carousel</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModal(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Slide
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="rounded-lg border border-gray-200 bg-white py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Slides</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {slideCounts.total}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-green-200 bg-white py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-green-600">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {slideCounts.active}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-gray-200 bg-white py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="mt-1 text-2xl font-bold text-gray-500">
              {slideCounts.inactive}
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardCard contentClassName="p-0">
        {isFetching && !isLoading && (
          <div className="h-0.5 overflow-hidden bg-blue-100">
            <div className="h-full w-full animate-pulse bg-blue-500" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : slides.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <SlidersHorizontal className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <p className="mb-1 text-lg font-medium">No hero slides yet</p>
            <p className="mb-4 text-sm">
              Create your first slide to display on the homepage carousel.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setCreateModal(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Slide
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-12 items-center gap-4 bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
              <div className="col-span-1">Order</div>
              <div className="col-span-2">Preview</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Linked</div>
              <div className="col-span-1">Active</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {slides.map((slide, index) => {
              const linkedTitle = getLinkedContentTitle(
                slide.content_type,
                slide.content_id,
              );
              const subtitle = getSlideDescription(slide);

              return (
                <div
                  key={slide.id}
                  className={`grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors ${
                    !slide.is_active ? "bg-gray-50/50 opacity-60" : ""
                  } hover:bg-gray-50`}
                >
                  <div className="col-span-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || reordering}
                        className="h-auto p-0.5 text-gray-400 hover:bg-transparent hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-sm font-bold tabular-nums text-gray-500">
                        {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === slides.length - 1 || reordering}
                        className="h-auto p-0.5 text-gray-400 hover:bg-transparent hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    {slide.custom_image ? (
                      <div className="h-16 w-full overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={slide.custom_image}
                          alt={slide.custom_title || linkedTitle || "Slide"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-full items-center justify-center rounded-lg bg-gray-100">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="col-span-3">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {slide.custom_title || linkedTitle || "(Linked content title)"}
                    </p>
                    {subtitle && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {subtitle}
                      </p>
                    )}
                    {slide.custom_link && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-blue-500">
                        <LinkIcon className="h-3 w-3" />
                        {slide.custom_link}
                      </p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${getContentTypeBadgeColor(slide.content_type)}`}
                    >
                      {getContentTypeLabel(slide.content_type)}
                    </span>
                  </div>

                  <div className="col-span-1">
                    {slide.content_id ? (
                      <span className="block truncate text-xs text-gray-500">
                        {linkedTitle || `${slide.content_id.slice(0, 8)}...`}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>

                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(slide)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                        slide.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      title={
                        slide.is_active
                          ? "Click to deactivate"
                          : "Click to activate"
                      }
                    >
                      {slide.is_active ? (
                        <>
                          <Eye className="h-3 w-3" />
                          On
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Off
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="col-span-3 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(slide)}
                      title="Edit slide"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, slide })}
                      title="Delete slide"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {reordering && (
          <div className="border-t border-blue-100 bg-blue-50 px-6 py-2 text-center">
            <span className="text-xs font-medium text-blue-600">
              Saving new order...
            </span>
          </div>
        )}
      </DashboardCard>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Tip:</strong> You can mix content types in the hero slider,
          like article posts and featured photo collections. Linked slides pull
          title/image/link automatically, and custom fields override any value.
        </p>
      </div>

      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create New Hero Slide"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Slide"}
            </Button>
          </div>
        }
      >
        {slideForm}
      </Modal>

      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, slide: null })}
        title="Edit Hero Slide"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditModal({ open: false, slide: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        {slideForm}
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, slide: null })}
        onConfirm={handleDelete}
        title="Delete Hero Slide"
        message={`Are you sure you want to delete this hero slide${deleteDialog.slide?.custom_title ? ` "${deleteDialog.slide.custom_title}"` : ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
