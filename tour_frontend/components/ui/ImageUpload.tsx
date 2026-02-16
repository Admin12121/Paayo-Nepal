"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { getCsrfToken } from "@/lib/csrf";
import Image from "next/image";
import Button from "./button";
import { toast } from "@/lib/utils/toast";
import { apiFetch } from "@/lib/csrf";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
}

export default function ImageUpload({
  value,
  onChange,
  onRemove,
  label = "Upload Image",
  accept = "image/*",
  maxSizeMB = 20,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const uploadWithProgress = useCallback(
    (file: File): Promise<{ url: string; id?: string }> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              // Backend now returns a computed `url` field (e.g. `/uploads/uuid.avif`).
              // Fall back to constructing from `filename` for backwards compatibility.
              const imageUrl =
                data.url ||
                (data.filename ? `/uploads/${data.filename}` : null);
              if (!imageUrl) {
                reject(new Error("No URL returned from server"));
                return;
              }
              resolve({ url: imageUrl, id: data.id });
            } catch {
              reject(new Error("Invalid response from server"));
            }
          } else {
            let message = "Upload failed";
            try {
              const errData = JSON.parse(xhr.responseText);
              if (errData.message) message = errData.message;
            } catch {
              // ignore parse error
            }
            reject(new Error(message));
          }
        });

        xhr.addEventListener("error", () => {
          xhrRef.current = null;
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          xhrRef.current = null;
          reject(new Error("Upload cancelled"));
        });

        const formData = new FormData();
        formData.append("file", file);

        xhr.open("POST", "/api/media");
        xhr.withCredentials = true;
        // CSRF protection — attach token header for state-changing request
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          xhr.setRequestHeader("X-CSRF-Token", csrfToken);
        }
        xhr.send(formData);
      });
    },
    [],
  );

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`Image must be less than ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadWithProgress(file);

      // Track media ID so we can clean up orphans on remove
      if (result.id) {
        setUploadedMediaId(result.id);
      }

      onChange(result.url);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = async () => {
    // Cancel any in-flight upload
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }

    // Best-effort cleanup of the uploaded media to avoid orphans
    if (uploadedMediaId) {
      try {
        await apiFetch(`/api/media/${uploadedMediaId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.warn("Failed to delete orphaned media:", err);
      }
      setUploadedMediaId(null);
    }

    // Reset file input so re-uploading the same file triggers onChange
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onRemove?.();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {value ? (
        <div className="relative group overflow-hidden rounded-lg border border-gray-300">
          <div className="relative w-full h-64">
            <Image
              src={value}
              alt="Preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
              unoptimized={value.startsWith("/uploads")}
            />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Change
            </Button>
            {onRemove && (
              <Button variant="danger" size="sm" onClick={handleRemove}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
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
          onClick={() => !uploading && inputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-2">
                Uploading... {progress}%
              </p>
              {/* Progress bar */}
              <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">Please wait...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1">
                Drop an image here or click to browse
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, GIF up to {maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
