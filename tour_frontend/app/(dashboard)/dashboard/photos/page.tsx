"use client";

import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Camera,
  Star,
  StarOff,
  CheckCircle,
  ImagePlus,
} from "lucide-react";
import type {
  PhotoFeature,
  PhotoImage,
  CreatePhotoFeatureInput,
} from "@/lib/api-client";
import {
  useListPhotosQuery,
  useCreatePhotoMutation,
  useUpdatePhotoMutation,
  useDeletePhotoMutation,
  usePublishPhotoMutation,
  useListPhotoImagesQuery,
  useAddPhotoImageMutation,
  useRemovePhotoImageMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

export default function PhotoFeaturesPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageCaption, setNewImageCaption] = useState("");
  const [deleteImageDialog, setDeleteImageDialog] = useState<{
    open: boolean;
    image: PhotoImage | null;
  }>({ open: false, image: null });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListPhotosQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadPhotos()` pattern!
  const {
    data: photosResponse,
    isLoading,
    isFetching,
  } = useListPhotosQuery({
    page: currentPage,
    limit: 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListPhotosQuery` to refetch.
  // No more manual `loadPhotos()` calls after every mutation!
  const [createPhoto, { isLoading: creating }] = useCreatePhotoMutation();
  const [updatePhoto, { isLoading: updatingPhoto }] = useUpdatePhotoMutation();
  const [deletePhoto, { isLoading: deleting }] = useDeletePhotoMutation();
  const [publishPhoto] = usePublishPhotoMutation();
  const [addPhotoImage, { isLoading: addingImage }] =
    useAddPhotoImageMutation();
  const [removePhotoImage, { isLoading: deletingImage }] =
    useRemovePhotoImageMutation();

  const saving = creating || updatingPhoto;

  // Conditionally fetch images when the images modal is open
  const { data: images = [], isLoading: imagesLoading } =
    useListPhotoImagesQuery(imagesModal.photo?.id ?? "", {
      skip: !imagesModal.open || !imagesModal.photo,
    });

  // ── Derived data ────────────────────────────────────────────────────────
  const photos = photosResponse?.data ?? [];
  const totalPages = photosResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredPhotos = photos.filter((photo) =>
    searchQuery
      ? photo.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.photo) return;

    try {
      await deletePhoto(deleteDialog.photo.id).unwrap();
      toast.success("Photo feature deleted successfully");
      setDeleteDialog({ open: false, photo: null });
    } catch {
      toast.error("Failed to delete photo feature");
    }
  };

  const handlePublish = async (photo: PhotoFeature) => {
    try {
      await publishPhoto(photo.id).unwrap();
      toast.success("Photo feature published successfully");
    } catch {
      toast.error("Failed to publish photo feature");
    }
  };

  const handleToggleFeatured = async (photo: PhotoFeature) => {
    try {
      await updatePhoto({
        id: photo.id,
        data: { is_featured: !photo.is_featured },
      }).unwrap();
      toast.success(
        photo.is_featured ? "Removed from featured" : "Added to featured",
      );
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      await createPhoto(formData).unwrap();
      toast.success("Photo feature created successfully");
      setCreateModal(false);
      resetForm();
    } catch {
      toast.error("Failed to create photo feature");
    }
  };

  const handleUpdate = async () => {
    if (!editModal.photo) return;

    try {
      await updatePhoto({
        id: editModal.photo.id,
        data: formData,
      }).unwrap();
      toast.success("Photo feature updated successfully");
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
    setImagesModal({ open: true, photo });
  };

  const handleAddImage = async () => {
    if (!imagesModal.photo || !newImageUrl.trim()) {
      toast.error("Image URL is required");
      return;
    }

    try {
      await addPhotoImage({
        photoId: imagesModal.photo.id,
        data: {
          image_url: newImageUrl.trim(),
          caption: newImageCaption.trim() || undefined,
          display_order: images.length,
        },
      }).unwrap();
      toast.success("Image added successfully");
      setNewImageUrl("");
      setNewImageCaption("");
    } catch {
      toast.error("Failed to add image");
    }
  };

  const handleDeleteImage = async () => {
    if (!imagesModal.photo || !deleteImageDialog.image) return;

    try {
      await removePhotoImage({
        photoId: imagesModal.photo.id,
        imageId: deleteImageDialog.image.id,
      }).unwrap();
      toast.success("Image removed successfully");
      setDeleteImageDialog({ open: false, image: null });
    } catch {
      toast.error("Failed to remove image");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
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

  const photoForm = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Photo feature title"
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
          placeholder="Describe this photo collection..."
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="photo_is_featured"
          checked={formData.is_featured || false}
          onChange={(e) =>
            setFormData({ ...formData, is_featured: e.target.checked })
          }
        />
        <label htmlFor="photo_is_featured" className="text-sm text-gray-700">
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
          <h1 className="text-3xl font-bold text-gray-900">Photo Features</h1>
          <p className="text-gray-600 mt-1">
            Manage photo galleries and collections
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Photo Feature
        </Button>
      </div>

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search photo features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
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
        </div>

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No photo features found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Images
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Featured
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPhotos.map((photo) => (
                  <tr key={photo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {photo.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          /{photo.slug}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openImagesModal(photo)}
                        className="h-auto px-0 py-0 text-sm text-blue-600 hover:bg-transparent hover:text-blue-800"
                      >
                        <Camera className="w-4 h-4" />
                        {photo.images?.length ?? 0} images
                      </Button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(photo.status)}`}
                      >
                        {photo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFeatured(photo)}
                        className="h-auto p-0 text-gray-400 hover:bg-transparent hover:text-yellow-500"
                        title={
                          photo.is_featured
                            ? "Remove from featured"
                            : "Add to featured"
                        }
                      >
                        {photo.is_featured ? (
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="w-5 h-5" />
                        )}
                      </Button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {photo.view_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(photo.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {photo.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(photo)}
                            title="Publish"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openImagesModal(photo)}
                          title="Manage images"
                        >
                          <ImagePlus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(photo)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, photo })}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      </DashboardCard>

      {/* Create Modal */}
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
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        }
      >
        {photoForm}
      </Modal>

      {/* Edit Modal */}
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
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        {photoForm}
      </Modal>

      {/* Images Management Modal */}
      <Modal
        isOpen={imagesModal.open}
        onClose={() => {
          setImagesModal({ open: false, photo: null });
          setNewImageUrl("");
          setNewImageCaption("");
        }}
        title={`Images — ${imagesModal.photo?.title || ""}`}
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
        <div className="space-y-6">
          {/* Add Image Form */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Add New Image
            </h4>
            <div className="space-y-3">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Image URL (https://...)"
              />
              <Input
                value={newImageCaption}
                onChange={(e) => setNewImageCaption(e.target.value)}
                placeholder="Caption (optional)"
              />
              <Button
                onClick={handleAddImage}
                disabled={addingImage || !newImageUrl.trim()}
                size="sm"
              >
                {addingImage ? (
                  "Adding..."
                ) : (
                  <>
                    <ImagePlus className="w-4 h-4 mr-1" />
                    Add Image
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Images List */}
          {imagesLoading ? (
            <LoadingSpinner />
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">
                No images yet. Add your first image above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...images]
                .sort((a, b) => a.display_order - b.display_order)
                .map((image) => (
                  <div
                    key={image.id}
                    className="group relative rounded-lg overflow-hidden border border-gray-200"
                  >
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={image.image_url}
                        alt={image.caption || "Photo"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteImageDialog({ open: true, image })
                        }
                        className="h-auto rounded-full bg-red-500 p-2 text-white hover:bg-red-600"
                        title="Remove image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {image.caption && (
                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-600 truncate">
                          {image.caption}
                        </p>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                      #{image.display_order + 1}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Photo Feature Confirm */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, photo: null })}
        onConfirm={handleDelete}
        title="Delete Photo Feature"
        message={`Are you sure you want to delete "${deleteDialog.photo?.title}"? This will also delete all associated images. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />

      {/* Delete Image Confirm */}
      <ConfirmDialog
        isOpen={deleteImageDialog.open}
        onClose={() => setDeleteImageDialog({ open: false, image: null })}
        onConfirm={handleDeleteImage}
        title="Remove Image"
        message="Are you sure you want to remove this image from the gallery?"
        confirmLabel="Remove"
        variant="danger"
        isLoading={deletingImage}
      />
    </div>
  );
}
