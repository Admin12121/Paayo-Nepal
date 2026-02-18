"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  X,
  Settings2,
  Save,
  Send,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/csrf";
import Image from "next/image";
import { postsApi } from "@/lib/api-client";
import NotionEditorField from "@/components/editor/NotionEditorField";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Textarea from "@/components/ui/Textarea";
import { toast } from "@/lib/utils/toast";

export default function NewPostPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const shortDescriptionRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    content: "",
    cover_image: "",
    post_type: "article",
    tags: "",
  });

  const uploadToMedia = useCallback(async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);

    const response = await apiFetch("/api/media", {
      method: "POST",
      body: fd,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = (await response.json()) as { url?: string; filename?: string };
    const url = data.url || (data.filename ? `/uploads/${data.filename}` : "");
    if (!url) throw new Error("No file URL returned");
    return url;
  }, []);

  const handleCoverFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be less than 20MB");
      return;
    }

    setCoverUploading(true);
    try {
      const url = await uploadToMedia(file);
      setFormData((prev) => ({
        ...prev,
        cover_image: url,
      }));
    } catch {
      toast.error("Failed to upload cover image");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCoverFile(file);
  };

  const handleCoverInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCoverFile(file);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Focus the editor area
      const editorEl = document.querySelector(
        '[contenteditable="true"]',
      ) as HTMLElement;
      if (editorEl) editorEl.focus();
    }
  };

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const autoResizeTitle = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      resizeTextarea(textarea);
      setFormData((prev) => ({ ...prev, title: textarea.value }));
    },
    [resizeTextarea],
  );

  const handleSubmit = async (publish = false) => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      titleRef.current?.focus();
      return;
    }

    if (!formData.content.trim()) {
      toast.error("Content is required");
      return;
    }

    setSaving(true);
    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      // Auto-populate SEO from title and description
      const postData = {
        title: formData.title,
        short_description: formData.short_description || undefined,
        content: formData.content,
        cover_image: formData.cover_image || undefined,
        post_type: formData.post_type,
        tags: tags.length > 0 ? tags : undefined,
        meta_title: formData.title || undefined,
        meta_description: formData.short_description || undefined,
      };

      const post = await postsApi.create(postData);

      if (publish) {
        await postsApi.publish(post.id);
        toast.success("Post published successfully!");
      } else {
        toast.success("Post saved as draft");
      }

      router.push("/dashboard/posts");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save post";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const postTypeOptions = [
    { value: "article", label: "Article", icon: "📝" },
    { value: "event", label: "Event", icon: "📅" },
    { value: "activity", label: "Activity", icon: "🎯" },
    { value: "explore", label: "Explore", icon: "🧭" },
  ];

  return (
    <div className="h-[calc(100svh-4rem)] overflow-hidden">
      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/posts"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <span className="text-sm text-gray-400">
            {formData.title || "Untitled"}
          </span>

          {formData.title && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`h-auto px-3 py-1.5 text-sm ${
              showSettings
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="h-auto gap-1.5 border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Draft
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="h-auto gap-1.5 bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-white" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publish
          </Button>
        </div>
      </div>

      <div className="scrollbar-hide flex h-[calc(100svh-8rem)] overflow-y-auto overflow-x-hidden">
        {/* ─── Main Editor Area ─── */}
        <div className="flex-1">
          {/* ─── Cover Image ─── */}
          {formData.cover_image ? (
            <div className="group relative">
              <div className="relative h-[280px] w-full overflow-hidden sm:h-[340px]">
                <Image
                  src={formData.cover_image}
                  alt="Cover"
                  fill
                  className="object-cover"
                  sizes="100vw"
                  unoptimized={formData.cover_image.startsWith("/uploads")}
                  priority
                />
              </div>
              <div className="absolute inset-0 flex p-2 items-start justify-end gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => coverInputRef.current?.click()}
                  className="h-auto bg-white/90 px-4 py-2 text-sm font-medium text-gray-800 shadow-lg backdrop-blur-sm hover:bg-white"
                >
                  Change cover
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, cover_image: "" }))
                  }
                  className="h-auto bg-red-500/90 p-2 text-white shadow-lg backdrop-blur-sm hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`group relative cursor-pointer transition-colors ${
                coverDragActive ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setCoverDragActive(true);
              }}
              onDragLeave={() => setCoverDragActive(false)}
              onDrop={handleCoverDrop}
              onClick={() => coverInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 transition-colors group-hover:text-gray-500">
                {coverUploading ? (
                  <>
                    <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                    <span className="text-sm">Uploading...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="mb-2 h-8 w-8 stroke-[1.5]" />
                    <span className="text-sm font-medium">
                      Add a cover image
                    </span>
                    <span className="mt-0.5 text-xs text-gray-300">
                      Drag & drop or click to browse
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <Input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverInputChange}
            className="hidden"
          />

          {/* ─── Content Area ─── */}
          <div className="mx-auto max-w-[720px] px-6 py-10 sm:px-12 lg:px-16">
            {/* Title */}
            <Textarea
              ref={titleRef}
              value={formData.title}
              onChange={autoResizeTitle}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled"
              className="mb-2 w-full text-5xl! min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-[2.5rem] font-bold leading-tight text-gray-900 placeholder-gray-200 shadow-none focus-visible:ring-0"
              rows={1}
              style={{ minHeight: "3.5rem" }}
            />

            {/* Short Description */}
            <Textarea
              ref={shortDescriptionRef}
              value={formData.short_description}
              onChange={(e) => {
                const target = e.target;
                resizeTextarea(target);
                setFormData((prev) => ({
                  ...prev,
                  short_description: target.value,
                }));
              }}
              placeholder="Add a brief description..."
              className="mb-8 w-full min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-lg leading-relaxed text-gray-400 placeholder-gray-200 shadow-none focus-visible:ring-0"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                resizeTextarea(target);
              }}
            />

            {/* Divider */}
            <Separator className="mb-6 bg-gray-100" />

            <NotionEditorField
              variant="inline"
              onChange={(html) =>
                setFormData((prev) => ({ ...prev, content: html }))
              }
              placeholder="Type '/' for commands, or just start writing..."
              uploadImage={uploadToMedia}
            />
          </div>
        </div>

        {/* ─── Settings Panel (slide in from right) ─── */}
        <div
          className={`shrink-0 border-l border-gray-200/80 bg-gray-50/70 transition-all duration-300 ease-in-out ${
            showSettings
              ? "w-[320px] translate-x-0 opacity-100"
              : "w-0 translate-x-4 overflow-hidden opacity-0"
          }`}
        >
          <div className="scrollbar-hide sticky top-[45px] h-[calc(100svh-4rem-45px)] w-[320px] overflow-y-auto">
            <div className="p-5">
              {/* Panel Header */}
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-gray-900">
                  Post Settings
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                  className="h-7 w-7 p-0 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Post Type */}
              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Post Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {postTypeOptions.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          post_type: opt.value,
                        }))
                      }
                      className={`h-auto w-full justify-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${
                        formData.post_type === opt.value
                          ? "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="font-medium">{opt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              {/* Tags */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <Tag className="h-3 w-3" />
                  Tags
                </label>
                <Input
                  type="text"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tags: e.target.value }))
                  }
                  placeholder="travel, nepal, hiking..."
                  className="h-10 rounded-lg border-gray-200 bg-white px-3 text-[13px] text-gray-700 placeholder-gray-300 shadow-sm focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-50"
                />
                <p className="mt-1.5 text-[11px] text-gray-400">
                  Separate with commas
                </p>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              {/* SEO info — auto-populated */}
              <div className="mb-5 rounded-lg border border-gray-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  SEO (Auto)
                </p>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Meta title and description are automatically set from the post
                  title and description. No manual input needed.
                </p>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              {/* Editor Hints */}
              <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-gray-400">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  <div>
                    <p className="mb-1">
                      Type{" "}
                      <kbd className="rounded-sm border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                        /
                      </kbd>{" "}
                      to insert blocks.
                    </p>
                    <p>
                      Select text to format it. Drag blocks with the grip
                      handle.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
