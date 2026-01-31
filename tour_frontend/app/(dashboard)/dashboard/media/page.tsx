"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, Search, Image as ImageIcon, X } from "lucide-react";
import { mediaApi, Media, PaginatedResponse } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/utils/toast";

export default function MediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    media: Media | null;
  }>({
    open: false,
    media: null,
  });
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMedia();
  }, [currentPage, typeFilter]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit: 24 };
      if (typeFilter !== "all") params.type = typeFilter;

      const response = await mediaApi.list(params);
      setMedia(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error("Failed to load media");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);

        const response = await fetch("/api/media", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) throw new Error("Upload failed");
      }

      toast.success(`${files.length} file(s) uploaded successfully`);
      setUploadModal(false);
      loadMedia();
    } catch (error) {
      toast.error("Failed to upload files");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDelete = async () => {
    if (!deleteDialog.media) return;

    setDeleting(true);
    try {
      await mediaApi.delete(deleteDialog.media.id);
      toast.success("Media deleted successfully");
      setDeleteDialog({ open: false, media: null });
      loadMedia();
    } catch (error) {
      toast.error("Failed to delete media");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredMedia = media.filter((item) =>
    searchQuery
      ? item.original_name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Library</h1>
          <p className="text-gray-600 mt-1">Manage your images and files</p>
        </div>
        <Button onClick={() => setUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Media
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "all", label: "All Types" },
              { value: "image", label: "Images" },
              { value: "video", label: "Videos" },
              { value: "document", label: "Documents" },
            ]}
            className="min-w-[150px]"
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No media files found</p>
            <Button className="mt-4" onClick={() => setUploadModal(true)}>
              Upload your first file
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
              {filteredMedia.map((item) => (
                <div key={item.id} className="group relative">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    {item.media_type === "image" ? (
                      <img
                        src={item.filename}
                        alt={item.alt || item.original_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setDeleteDialog({ open: true, media: item })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <p
                      className="text-xs text-gray-700 truncate"
                      title={item.original_name}
                    >
                      {item.original_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(item.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={uploadModal}
        onClose={() => setUploadModal(false)}
        title="Upload Media"
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setUploadModal(false)}>
            Close
          </Button>
        }
      >
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
            }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-lg text-gray-700">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg text-gray-700 mb-2">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Support for images, videos, and documents up to 10MB
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, media: null })}
        onConfirm={handleDelete}
        title="Delete Media"
        message={`Are you sure you want to delete "${deleteDialog.media?.original_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
