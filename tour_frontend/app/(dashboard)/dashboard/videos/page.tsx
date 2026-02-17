"use client";

import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Video,
  Star,
  StarOff,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import type { Video as VideoType, CreateVideoInput } from "@/lib/api-client";
import {
  useListVideosQuery,
  useCreateVideoMutation,
  useUpdateVideoMutation,
  useDeleteVideoMutation,
  usePublishVideoMutation,
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

export default function VideosPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    video: VideoType | null;
  }>({ open: false, video: null });
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    video: VideoType | null;
  }>({ open: false, video: null });
  const [formData, setFormData] = useState<CreateVideoInput>({
    title: "",
    video_url: "",
    platform: "youtube",
    description: "",
    thumbnail_url: "",
    region_id: "",
    is_featured: false,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListVideosQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadVideos()` pattern!
  const {
    data: videosResponse,
    isLoading,
    isFetching,
  } = useListVideosQuery({
    page: currentPage,
    limit: 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListVideosQuery` to refetch.
  // No more manual `loadVideos()` calls after every mutation!
  const [createVideo, { isLoading: creating }] = useCreateVideoMutation();
  const [updateVideo, { isLoading: updatingVideo }] = useUpdateVideoMutation();
  const [deleteVideo, { isLoading: deleting }] = useDeleteVideoMutation();
  const [publishVideo] = usePublishVideoMutation();

  const saving = creating || updatingVideo;

  // ── Derived data ────────────────────────────────────────────────────────
  const videos = videosResponse?.data ?? [];
  const totalPages = videosResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredVideos = videos.filter((video) =>
    searchQuery
      ? video.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.video) return;

    try {
      await deleteVideo(deleteDialog.video.id).unwrap();
      toast.success("Video deleted successfully");
      setDeleteDialog({ open: false, video: null });
    } catch {
      toast.error("Failed to delete video");
    }
  };

  const handlePublish = async (video: VideoType) => {
    try {
      await publishVideo(video.id).unwrap();
      toast.success("Video published successfully");
    } catch {
      toast.error("Failed to publish video");
    }
  };

  const handleToggleFeatured = async (video: VideoType) => {
    try {
      await updateVideo({
        id: video.id,
        data: { is_featured: !video.is_featured },
      }).unwrap();
      toast.success(
        video.is_featured ? "Removed from featured" : "Added to featured",
      );
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.video_url.trim()) {
      toast.error("Title and video URL are required");
      return;
    }

    try {
      await createVideo(formData).unwrap();
      toast.success("Video created successfully");
      setCreateModal(false);
      resetForm();
    } catch {
      toast.error("Failed to create video");
    }
  };

  const handleUpdate = async () => {
    if (!editModal.video) return;

    try {
      await updateVideo({
        id: editModal.video.id,
        data: formData,
      }).unwrap();
      toast.success("Video updated successfully");
      setEditModal({ open: false, video: null });
      resetForm();
    } catch {
      toast.error("Failed to update video");
    }
  };

  const openEditModal = (video: VideoType) => {
    setFormData({
      title: video.title,
      video_url: video.video_url,
      platform: video.platform,
      description: video.description || "",
      thumbnail_url: video.thumbnail_url || "",
      region_id: video.region_id || "",
      is_featured: video.is_featured,
    });
    setEditModal({ open: true, video });
  };

  const resetForm = () => {
    setFormData({
      title: "",
      video_url: "",
      platform: "youtube",
      description: "",
      thumbnail_url: "",
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

  const videoForm = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Video title"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Video URL *
        </label>
        <Input
          value={formData.video_url}
          onChange={(e) =>
            setFormData({ ...formData, video_url: e.target.value })
          }
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Platform
          </label>
          <Select
            value={formData.platform || "youtube"}
            onChange={(e) =>
              setFormData({ ...formData, platform: e.target.value })
            }
            options={[
              { value: "youtube", label: "YouTube" },
              { value: "vimeo", label: "Vimeo" },
              { value: "tiktok", label: "TikTok" },
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (seconds)
          </label>
          <Input
            type="number"
            value={formData.duration || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                duration: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            placeholder="e.g. 300"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thumbnail URL
        </label>
        <Input
          value={formData.thumbnail_url || ""}
          onChange={(e) =>
            setFormData({ ...formData, thumbnail_url: e.target.value })
          }
          placeholder="https://..."
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
          placeholder="Video description..."
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="is_featured"
          checked={formData.is_featured || false}
          onChange={(e) =>
            setFormData({ ...formData, is_featured: e.target.checked })
          }
        />
        <label htmlFor="is_featured" className="text-sm text-gray-700">
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
          <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
          <p className="text-gray-600 mt-1">Manage your video content</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Video
        </Button>
      </div>

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search videos..."
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
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No videos found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Video
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
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
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {video.thumbnail_url && (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-16 h-10 object-cover rounded mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {video.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            /{video.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">
                        {video.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(video.status)}`}
                      >
                        {video.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFeatured(video)}
                        className="h-auto p-0 text-gray-400 hover:bg-transparent hover:text-yellow-500"
                        title={
                          video.is_featured
                            ? "Remove from featured"
                            : "Add to featured"
                        }
                      >
                        {video.is_featured ? (
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="w-5 h-5" />
                        )}
                      </Button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {video.view_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(video.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {video.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(video)}
                            title="Publish"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" title="Open URL">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(video)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, video })}
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
        title="Create New Video"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Video"}
            </Button>
          </div>
        }
      >
        {videoForm}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, video: null })}
        title="Edit Video"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditModal({ open: false, video: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        {videoForm}
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, video: null })}
        onConfirm={handleDelete}
        title="Delete Video"
        message={`Are you sure you want to delete "${deleteDialog.video?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
