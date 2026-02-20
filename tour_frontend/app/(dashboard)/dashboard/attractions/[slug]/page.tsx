"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/animated-link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { apiFetch } from "@/lib/csrf";
import {
  useDeleteAttractionMutation,
  useGetAttractionBySlugQuery,
  useListRegionsQuery,
  useUpdateAttractionMutation,
} from "@/lib/store";
import {
  contentLinksApi,
  photoFeaturesApi,
  postsApi,
  type ContentLink,
  type ContentLinkTargetType,
  videosApi,
} from "@/lib/api-client";
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import NotionEditorField from "@/components/editor/NotionEditorField";
import { Separator } from "@/components/ui/separator";
import Textarea from "@/components/ui/Textarea";
import { NumberTicker } from "@/components/ui/number-ticker";
import { toast } from "@/lib/utils/toast";

interface AttractionFormData {
  title: string;
  short_description: string;
  content: string;
  cover_image: string;
  region_id: string;
  is_featured: boolean;
  status: string;
}

const EMPTY_FORM: AttractionFormData = {
  title: "",
  short_description: "",
  content: "",
  cover_image: "",
  region_id: "",
  is_featured: false,
  status: "draft",
};

function toEditorContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

export default function DashboardAttractionDetailPage() {
  const params = useParams();
  const router = useRouter();

  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const [formData, setFormData] = useState<AttractionFormData>(EMPTY_FORM);
  const [initializedAttractionId, setInitializedAttractionId] = useState<
    string | null
  >(null);
  const [showSettings, setShowSettings] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [activeAction, setActiveAction] = useState<"save" | "publish" | null>(
    null,
  );
  const [contentLinks, setContentLinks] = useState<ContentLink[]>([]);
  const [linkTargetType, setLinkTargetType] =
    useState<ContentLinkTargetType>("post");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [postsOptions, setPostsOptions] = useState<
    { id: string; title: string }[]
  >([]);
  const [photosOptions, setPhotosOptions] = useState<
    { id: string; title: string }[]
  >([]);
  const [videosOptions, setVideosOptions] = useState<
    { id: string; title: string }[]
  >([]);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const shortDescriptionRef = useRef<HTMLTextAreaElement>(null);

  const {
    data: attraction,
    isLoading,
    isFetching,
    error,
    refetch: refetchAttraction,
  } = useGetAttractionBySlugQuery(slug ?? "", {
    skip: !slug,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const { data: regionsResponse } = useListRegionsQuery(
    { limit: 100 },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );
  const regions = regionsResponse?.data ?? [];

  const [updateAttraction] = useUpdateAttractionMutation();
  const [deleteAttraction, { isLoading: deleting }] = useDeleteAttractionMutation();

  useEffect(() => {
    if (!attraction) return;
    if (initializedAttractionId === attraction.id) return;

    setFormData({
      title: attraction.title,
      short_description: attraction.short_description || "",
      content: toEditorContent(attraction.content),
      cover_image: attraction.cover_image || "",
      region_id: attraction.region_id || "",
      is_featured: attraction.is_featured,
      status: attraction.status,
    });
    setInitializedAttractionId(attraction.id);
  }, [attraction, initializedAttractionId]);

  const loadContentLinks = useCallback(async (sourceId: string) => {
    try {
      const links = await contentLinksApi.listForSource("post", sourceId);
      setContentLinks(links);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load connected content");
    }
  }, []);

  useEffect(() => {
    if (!attraction?.id) return;
    void loadContentLinks(attraction.id);
  }, [attraction?.id, loadContentLinks]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [postsRes, photosRes, videosRes] = await Promise.all([
          postsApi.list({ limit: 100, status: "published" }),
          photoFeaturesApi.list({ limit: 100, status: "published" }),
          videosApi.list({ limit: 100, status: "published" }),
        ]);

        setPostsOptions(
          postsRes.data.map((item) => ({ id: item.id, title: item.title })),
        );
        setPhotosOptions(
          photosRes.data.map((item) => ({ id: item.id, title: item.title })),
        );
        setVideosOptions(
          videosRes.data.map((item) => ({ id: item.id, title: item.title })),
        );
      } catch (error) {
        console.error(error);
      }
    };

    void loadOptions();
  }, []);

  const stats = useMemo(() => {
    if (!attraction) {
      return { likes: 0, views: 0 };
    }
    return {
      likes: attraction.likes ?? attraction.like_count ?? 0,
      views: attraction.views ?? attraction.view_count ?? 0,
    };
  }, [attraction]);

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

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
      const editorEl = document.querySelector(
        '[contenteditable="true"]',
      ) as HTMLElement;
      if (editorEl) editorEl.focus();
    }
  };

  const autoResizeTitle = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      resizeTextarea(textarea);
      setFormData((prev) => ({ ...prev, title: textarea.value }));
    },
    [resizeTextarea],
  );

  useEffect(() => {
    if (titleRef.current) resizeTextarea(titleRef.current);
    if (shortDescriptionRef.current) resizeTextarea(shortDescriptionRef.current);
  }, [formData.title, formData.short_description, resizeTextarea]);

  const handleSubmit = async (publish = false) => {
    if (!attraction) return;
    if (!formData.title.trim()) {
      toast.error("Attraction name is required");
      titleRef.current?.focus();
      return;
    }

    setActiveAction(publish ? "publish" : "save");
    try {
      const updatedAttraction = await updateAttraction({
        slug: attraction.slug,
        data: {
          title: formData.title.trim(),
          short_description: formData.short_description.trim() || null,
          content: formData.content || null,
          cover_image: formData.cover_image.trim() || null,
          region_id: formData.region_id || null,
          is_featured: formData.is_featured,
          status: publish ? "published" : formData.status,
        },
      }).unwrap();

      if (slug && updatedAttraction.slug !== slug) {
        router.replace(`/dashboard/attractions/${updatedAttraction.slug}`);
        router.refresh();
        return;
      }

      setInitializedAttractionId(null);
      await refetchAttraction();
      toast.success(
        publish
          ? "Attraction published successfully"
          : "Attraction updated successfully",
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update attraction";
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  };

  const handleDelete = async () => {
    if (!attraction) return;
    if (
      !window.confirm(`Delete "${attraction.title}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await deleteAttraction(attraction.slug).unwrap();
      toast.success("Attraction deleted successfully");
      router.replace("/dashboard/attractions");
      router.refresh();
    } catch {
      toast.error("Failed to delete attraction");
    }
  };

  const getTargetOptions = () => {
    if (linkTargetType === "photo") return photosOptions;
    if (linkTargetType === "video") return videosOptions;
    return postsOptions.filter((item) => item.id !== attraction?.id);
  };

  const getLinkLabel = (link: ContentLink) => {
    const pool =
      link.target_type === "photo"
        ? photosOptions
        : link.target_type === "video"
          ? videosOptions
          : postsOptions;

    return (
      pool.find((item) => item.id === link.target_id)?.title || link.target_id
    );
  };

  const handleAddContentLink = async () => {
    if (!attraction?.id) return;
    if (!linkTargetId) {
      toast.error("Select an item to link");
      return;
    }
    if (
      contentLinks.some(
        (link) =>
          link.target_type === linkTargetType && link.target_id === linkTargetId,
      )
    ) {
      toast.error("This content is already linked");
      return;
    }

    try {
      setSavingLink(true);
      await contentLinksApi.create({
        source_type: "post",
        source_id: attraction.id,
        target_type: linkTargetType,
        target_id: linkTargetId,
        display_order: contentLinks.length,
      });
      await loadContentLinks(attraction.id);
      setLinkTargetId("");
      toast.success("Connected content added");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add connected content");
    } finally {
      setSavingLink(false);
    }
  };

  const handleMoveContentLink = async (
    index: number,
    direction: -1 | 1,
  ) => {
    if (!attraction?.id) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= contentLinks.length) return;

    const reordered = [...contentLinks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    try {
      setSavingLink(true);
      await contentLinksApi.setLinks(
        "post",
        attraction.id,
        reordered.map((link, orderIndex) => ({
          target_type: link.target_type,
          target_id: link.target_id,
          display_order: orderIndex,
        })),
      );
      await loadContentLinks(attraction.id);
      toast.success("Connected content order updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reorder connected content");
    } finally {
      setSavingLink(false);
    }
  };

  const handleRemoveContentLink = async (linkId: string) => {
    if (!attraction?.id) return;

    try {
      setSavingLink(true);
      await contentLinksApi.remove(linkId);
      await loadContentLinks(attraction.id);
      toast.success("Connected content removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove connected content");
    } finally {
      setSavingLink(false);
    }
  };

  const getStatusBadge = () => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-600",
      pending: "bg-amber-50 text-amber-600",
      approved: "bg-green-50 text-green-600",
      published: "bg-blue-50 text-blue-600",
    };
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          styles[formData.status] || styles.draft
        }`}
      >
        {formData.status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !attraction) {
    return (
      <div className="space-y-4 rounded-xl border bg-white p-8 text-center">
        <p className="text-slate-700">Attraction not found.</p>
        <div>
          <Link
            href="/dashboard/attractions"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Back to attractions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100svh-4rem)] overflow-hidden">
      {isFetching && (
        <div className="h-0.5 overflow-hidden bg-blue-100">
          <div className="h-full w-full animate-pulse bg-blue-500" />
        </div>
      )}

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/attractions"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Attractions</span>
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <span className="max-w-[220px] truncate text-sm text-gray-400">
            {formData.title || "Untitled"}
          </span>

          {getStatusBadge()}
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
            disabled={activeAction !== null}
            className="h-auto gap-1.5 border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {activeAction === "save" ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Update
          </Button>

          {formData.status !== "published" && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleSubmit(true)}
              disabled={activeAction !== null}
              className="h-auto gap-1.5 bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {activeAction === "publish" ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-white" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      <div className="scrollbar-hide flex h-[calc(100svh-8rem)] overflow-y-auto overflow-x-hidden">
        <div className="flex-1">
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
              <div className="absolute inset-0 flex items-start justify-end gap-2 bg-black/0 p-2 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
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
                      Drag and drop or click to browse
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

          <div className="mx-auto max-w-[720px] px-6 py-10 sm:px-12 lg:px-16">
            <Textarea
              ref={titleRef}
              value={formData.title}
              onChange={autoResizeTitle}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled"
              className="mb-2 text-5xl! min-h-0 w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-[2.5rem] font-bold leading-tight text-gray-900 placeholder-gray-200 shadow-none focus-visible:ring-0"
              rows={1}
              style={{ minHeight: "3.5rem" }}
            />

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
              className="mb-8 min-h-0 w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-lg leading-relaxed text-gray-400 placeholder-gray-200 shadow-none focus-visible:ring-0"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                resizeTextarea(target);
              }}
            />

            <Separator className="mb-6 bg-gray-100" />

            <NotionEditorField
              variant="inline"
              initialContent={formData.content}
              onChange={(html) =>
                setFormData((prev) => ({ ...prev, content: html }))
              }
              placeholder="Type '/' for commands, or just start writing..."
              uploadImage={uploadToMedia}
            />
          </div>
        </div>

        <div
          className={`shrink-0 border-l border-gray-200/80 bg-gray-50/70 transition-all duration-300 ease-in-out ${
            showSettings
              ? "w-[320px] translate-x-0 opacity-100"
              : "w-0 translate-x-4 overflow-hidden opacity-0"
          }`}
        >
          <div className="scrollbar-hide sticky top-[45px] h-[calc(100svh-4rem-45px)] w-[320px] overflow-y-auto">
            <div className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-gray-900">
                  Attraction Settings
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

              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </label>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] capitalize text-gray-700 shadow-sm">
                  {formData.status}
                </div>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Region
                </label>
                <select
                  value={formData.region_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      region_id: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 shadow-sm outline-none focus:border-blue-300"
                >
                  <option value="">Select region...</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5 rounded-lg border border-gray-200 bg-white p-3">
                <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
                  <Checkbox
                    checked={formData.is_featured}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_featured: e.target.checked,
                      }))
                    }
                  />
                  Featured attraction
                </label>
                <p className="mt-2 text-[11px] text-gray-400">
                  Feature this attraction prominently on public pages.
                </p>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Connected Content
                </label>
                <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={linkTargetType}
                      onChange={(e) => {
                        setLinkTargetType(
                          e.target.value as ContentLinkTargetType,
                        );
                        setLinkTargetId("");
                      }}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-[12px] text-gray-700"
                    >
                      <option value="post">Post</option>
                      <option value="photo">Photo</option>
                      <option value="video">Video</option>
                    </select>
                    <select
                      value={linkTargetId}
                      onChange={(e) => setLinkTargetId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-[12px] text-gray-700"
                    >
                      <option value="">Select item...</option>
                      {getTargetOptions().map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddContentLink}
                    disabled={savingLink}
                    className="h-8 w-full text-xs"
                  >
                    Add Link
                  </Button>

                  <div className="space-y-1">
                    {contentLinks.length === 0 ? (
                      <p className="text-[11px] text-gray-400">
                        No linked content yet.
                      </p>
                    ) : (
                      contentLinks.map((link, index) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between rounded border border-gray-100 px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-gray-700">
                              {getLinkLabel(link)}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">
                              {link.target_type}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={savingLink || index === 0}
                              onClick={() => handleMoveContentLink(index, -1)}
                              className="text-[11px] text-gray-500 hover:text-gray-700 disabled:opacity-30"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              disabled={
                                savingLink || index === contentLinks.length - 1
                              }
                              onClick={() => handleMoveContentLink(index, 1)}
                              className="text-[11px] text-gray-500 hover:text-gray-700 disabled:opacity-30"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              disabled={savingLink}
                              onClick={() => handleRemoveContentLink(link.id)}
                              className="text-[11px] text-red-500 hover:text-red-600 disabled:opacity-30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="rounded-md bg-slate-100 p-2">
                  <p className="mb-1 text-slate-500">Views</p>
                  <p className="text-sm font-semibold text-slate-800">
                    <NumberTicker
                      value={stats.views ?? 0}
                      className="tracking-normal text-current dark:text-current"
                    />
                  </p>
                </div>
                <div className="rounded-md bg-slate-100 p-2">
                  <p className="mb-1 text-slate-500">Likes</p>
                  <p className="text-sm font-semibold text-slate-800">
                    <NumberTicker
                      value={stats.likes ?? 0}
                      className="tracking-normal text-current dark:text-current"
                    />
                  </p>
                </div>
              </div>

              <Link
                href={`/attractions/${attraction.slug}`}
                className="mb-5 inline-flex text-xs text-blue-600 hover:underline"
              >
                View public page
              </Link>

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5 rounded-lg border border-red-100 bg-white p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-400">
                  Danger Zone
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-9 w-full justify-center border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Attraction
                </Button>
              </div>

              <Separator className="my-4 bg-gray-200/80" />

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
                      Use headings, lists and images to structure attraction
                      details.
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
