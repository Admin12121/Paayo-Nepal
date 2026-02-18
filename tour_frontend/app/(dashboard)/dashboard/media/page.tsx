"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import type { Media } from "@/lib/api-client";
import {
  useListMediaQuery,
  useUploadMediaMutation,
  useDeleteMediaMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/utils/toast";

export default function MediaPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListMediaQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadMedia()` pattern!
  const {
    data: mediaResponse,
    isLoading,
    isFetching,
  } = useListMediaQuery(
    {
      page: currentPage,
      limit: 24,
      type: typeFilter !== "all" ? typeFilter : undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListMediaQuery` to refetch.
  // No more manual `loadMedia()` calls after every mutation!
  const [uploadMedia] = useUploadMediaMutation();
  const [deleteMedia, { isLoading: deleting }] = useDeleteMediaMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const media = mediaResponse?.data ?? [];
  const totalPages = mediaResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredMedia = media.filter((item) =>
    searchQuery
      ? item.original_name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let lastError = "";
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Client-side validations
        if (
          !file.type.startsWith("image/") &&
          !file.type.startsWith("video/") &&
          !file.type.startsWith("application/")
        ) {
          lastError = `"${file.name}" has an unsupported file type.`;
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          lastError = `"${file.name}" exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
          // Use RTK Query mutation for uploads.
          // On success, cache invalidation triggers automatic refetch of the list.
          await uploadMedia(formData).unwrap();
          successCount++;
        } catch (err: unknown) {
          const message =
            err && typeof err === "object" && "data" in err
              ? (err as { data?: { message?: string } }).data?.message ||
                `Upload failed for "${file.name}"`
              : `Upload failed for "${file.name}"`;
          lastError = message;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded successfully`);
        setUploadModal(false);
      }
      if (lastError) {
        toast.error(lastError);
      }
    } catch (error) {
      toast.error(
        "Failed to upload files. Please check your connection and try again.",
      );
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

    try {
      // `.unwrap()` throws on error so we can catch it.
      // On success, RTK Query invalidates 'Media' tags → list refetches automatically.
      await deleteMedia(deleteDialog.media.id).unwrap();
      toast.success("Media deleted successfully");
      setDeleteDialog({ open: false, media: null });
    } catch (error) {
      toast.error("Failed to delete media");
      console.error(error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  // ── Render ──────────────────────────────────────────────────────────────

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

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3">
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
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
                      <Image
                        src={
                          item.url ||
                          (item.filename.startsWith("/")
                            ? item.filename
                            : `/uploads/${item.filename}`)
                        }
                        alt={item.alt || item.original_name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                        unoptimized
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
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            dragActive
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
        <Input
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
