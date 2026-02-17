"use client";

import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Image as ImageIcon,
  Link as LinkIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { HeroSlide, CreateHeroSlideInput } from "@/lib/api-client";
import {
  useListAllHeroSlidesQuery,
  useGetHeroSlideCountsQuery,
  useCreateHeroSlideMutation,
  useUpdateHeroSlideMutation,
  useDeleteHeroSlideMutation,
  useToggleHeroSlideActiveMutation,
  useReorderHeroSlidesMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { Card, CardContent } from "@/components/ui/card";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

export default function HeroSlidesPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
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

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListAllHeroSlidesQuery` automatically:
  //   - Fetches data on mount
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadSlides()` pattern!
  const {
    data: rawSlides,
    isLoading,
    isFetching,
  } = useListAllHeroSlidesQuery();

  const { data: counts } = useGetHeroSlideCountsQuery();

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing queries to refetch.
  // No more manual `loadSlides()` calls after every mutation!
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

  // ── Derived data ────────────────────────────────────────────────────────
  const slides = rawSlides
    ? [...rawSlides].sort((a, b) => a.display_order - b.display_order)
    : [];

  const slideCounts = counts ?? { total: 0, active: 0, inactive: 0 };

  // ── Handlers ────────────────────────────────────────────────────────────

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
      toast.error("Content ID is required for linked slides");
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

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newSlides = [...slides];
    [newSlides[index - 1], newSlides[index]] = [
      newSlides[index],
      newSlides[index - 1],
    ];
    await saveOrder(newSlides);
  };

  const handleMoveDown = async (index: number) => {
    if (index === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[index], newSlides[index + 1]] = [
      newSlides[index + 1],
      newSlides[index],
    ];
    await saveOrder(newSlides);
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

  const openEditModal = (slide: HeroSlide) => {
    setFormData({
      content_type: slide.content_type,
      content_id: slide.content_id || "",
      custom_title: slide.custom_title || "",
      custom_description: slide.custom_subtitle || "",
      custom_image: slide.custom_image || "",
      custom_link: slide.custom_link || "",
      sort_order: slide.display_order,
      is_active: slide.is_active,
    });
    setEditModal({ open: true, slide });
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

  // ── Helpers ─────────────────────────────────────────────────────────────

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

  const slideForm = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content Type *
        </label>
        <Select
          value={formData.content_type}
          onChange={(e) =>
            setFormData({ ...formData, content_type: e.target.value })
          }
          options={[
            { value: "custom", label: "Custom (manual title/image)" },
            { value: "post", label: "Link to Post" },
            { value: "video", label: "Link to Video" },
            { value: "photo", label: "Link to Photo Feature" },
          ]}
        />
      </div>

      {formData.content_type !== "custom" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content ID *
          </label>
          <Input
            value={formData.content_id || ""}
            onChange={(e) =>
              setFormData({ ...formData, content_id: e.target.value })
            }
            placeholder="UUID of the linked content item"
          />
          <p className="text-xs text-gray-500 mt-1">
            The slide will automatically use the content&apos;s title, image,
            and link. Custom fields below will override them.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden bg-gray-100">
            <img
              src={formData.custom_image}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort Order
          </label>
          <Input
            type="number"
            value={formData.sort_order ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                sort_order: parseInt(e.target.value) || 0,
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hero Slides</h1>
          <p className="text-gray-600 mt-1">
            Manage the homepage hero carousel
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Slide
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="rounded-lg border border-gray-200 bg-white py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Slides</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {slideCounts.total}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-green-200 bg-white py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-green-600">Active</p>
            <p className="text-2xl font-bold text-green-700 mt-1">
              {slideCounts.active}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-gray-200 bg-white py-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">
              {slideCounts.inactive}
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardCard contentClassName="p-0">
        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : slides.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <SlidersHorizontal className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-1">No hero slides yet</p>
            <p className="text-sm mb-4">
              Create your first slide to display on the homepage carousel.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setCreateModal(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Slide
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Header */}
            <div className="px-6 py-3 bg-gray-50 grid grid-cols-12 gap-4 items-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Order</div>
              <div className="col-span-2">Preview</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Active</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors ${
                  !slide.is_active ? "opacity-60 bg-gray-50/50" : ""
                } hover:bg-gray-50`}
              >
                {/* Order */}
                <div className="col-span-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || reordering}
                      className="h-auto p-0.5 text-gray-400 hover:bg-transparent hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-sm font-bold text-gray-500 tabular-nums">
                      {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === slides.length - 1 || reordering}
                      className="h-auto p-0.5 text-gray-400 hover:bg-transparent hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Preview thumbnail */}
                <div className="col-span-2">
                  {slide.custom_image ? (
                    <div className="w-full h-16 rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={slide.custom_image}
                        alt={slide.custom_title || "Slide"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Title */}
                <div className="col-span-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {slide.custom_title || "(Linked content title)"}
                  </p>
                  {slide.custom_subtitle && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {slide.custom_subtitle}
                    </p>
                  )}
                  {slide.custom_link && (
                    <p className="text-xs text-blue-500 truncate mt-0.5 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" />
                      {slide.custom_link}
                    </p>
                  )}
                </div>

                {/* Type badge */}
                <div className="col-span-1">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${getContentTypeBadgeColor(slide.content_type)}`}
                  >
                    {getContentTypeLabel(slide.content_type)}
                  </span>
                </div>

                {/* Linked content ID */}
                <div className="col-span-1">
                  {slide.content_id ? (
                    <span className="text-xs text-gray-400 font-mono">
                      {slide.content_id.slice(0, 8)}…
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>

                {/* Active toggle */}
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(slide)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
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
                        <Eye className="w-3 h-3" />
                        On
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Off
                      </>
                    )}
                  </Button>
                </div>

                {/* Actions */}
                <div className="col-span-3 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(slide)}
                    title="Edit slide"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteDialog({ open: true, slide })}
                    title="Delete slide"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {reordering && (
          <div className="px-6 py-2 bg-blue-50 border-t border-blue-100 text-center">
            <span className="text-xs text-blue-600 font-medium">
              Saving new order…
            </span>
          </div>
        )}
      </DashboardCard>

      {/* Hint */}
      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Tip:</strong> Only active slides appear on the homepage. Use
          the up/down arrows to reorder slides. For linked content slides (Post,
          Video, Photo), the title, image, and link are automatically pulled
          from the content item — but you can override any of them with the
          custom fields.
        </p>
      </div>

      {/* Create Modal */}
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

      {/* Edit Modal */}
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

      {/* Delete Confirm */}
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
