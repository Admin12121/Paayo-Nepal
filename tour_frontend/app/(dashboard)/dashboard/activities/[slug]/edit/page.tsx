"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/ui/animated-link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Save,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/csrf";
import {
  Activity,
  type ContentLink,
  type ContentLinkTargetType,
  activitiesApi,
  contentLinksApi,
  photoFeaturesApi,
  postsApi,
  videosApi,
} from "@/lib/api-client";
import NotionEditorField from "@/components/editor/NotionEditorField";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Separator } from "@/components/ui/separator";
import Textarea from "@/components/ui/Textarea";
import { toast } from "@/lib/utils/toast";
import { baseApi, useAppDispatch } from "@/lib/store";

export default function EditActivityPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
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

  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    content: "",
    cover_image: "",
    is_featured: false,
  });

  const loadActivity = useCallback(async () => {
    try {
      const data = await activitiesApi.getBySlug(slug);
      setActivity(data);
      setFormData({
        title: data.title,
        short_description: data.short_description || "",
        content:
          typeof data.content === "string"
            ? data.content
            : JSON.stringify(data.content ?? ""),
        cover_image: data.cover_image || "",
        is_featured: data.is_featured,
      });
    } catch (error) {
      toast.error("Failed to load activity");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

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
    if (!activity?.id) return;
    void loadContentLinks(activity.id);
  }, [activity?.id, loadContentLinks]);

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

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!loading) {
      if (titleRef.current && formData.title) {
        resizeTextarea(titleRef.current);
      }
      if (shortDescriptionRef.current && formData.short_description) {
        resizeTextarea(shortDescriptionRef.current);
      }
    }
  }, [loading, formData.title, formData.short_description, resizeTextarea]);

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
      setFormData((prev) => ({ ...prev, cover_image: url }));
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

  const handleSubmit = async (publish = false) => {
    if (!formData.title.trim()) {
      toast.error("Activity title is required");
      titleRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        short_description: formData.short_description || null,
        content: formData.content || null,
        cover_image: formData.cover_image || null,
        is_featured: formData.is_featured,
      };

      if (publish) {
        payload.status = "published";
      }

      const updateResponse = await apiFetch(`/api/activities/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update activity");
      }

      toast.success(
        publish
          ? "Activity updated and published"
          : "Activity updated successfully",
      );
      dispatch(
        baseApi.util.invalidateTags([
          { type: "Activity", id: "LIST" },
          { type: "DashboardStats" },
        ]),
      );
      router.replace(`/dashboard/activities?refresh=${Date.now()}`);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update activity";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getTargetOptions = () => {
    if (linkTargetType === "photo") return photosOptions;
    if (linkTargetType === "video") return videosOptions;
    return postsOptions.filter((item) => item.id !== activity?.id);
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
    if (!activity?.id) return;
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
        source_id: activity.id,
        target_type: linkTargetType,
        target_id: linkTargetId,
        display_order: contentLinks.length,
      });
      await loadContentLinks(activity.id);
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
    if (!activity?.id) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= contentLinks.length) return;

    const reordered = [...contentLinks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    try {
      setSavingLink(true);
      await contentLinksApi.setLinks(
        "post",
        activity.id,
        reordered.map((link, orderIndex) => ({
          target_type: link.target_type,
          target_id: link.target_id,
          display_order: orderIndex,
        })),
      );
      await loadContentLinks(activity.id);
      toast.success("Connected content order updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reorder connected content");
    } finally {
      setSavingLink(false);
    }
  };

  const handleRemoveContentLink = async (linkId: string) => {
    if (!activity?.id) return;

    try {
      setSavingLink(true);
      await contentLinksApi.remove(linkId);
      await loadContentLinks(activity.id);
      toast.success("Connected content removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove connected content");
    } finally {
      setSavingLink(false);
    }
  };

  const statusBadge = activity ? (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        activity.status === "published"
          ? "bg-blue-50 text-blue-600"
          : activity.status === "pending"
            ? "bg-amber-50 text-amber-600"
            : "bg-gray-100 text-gray-600"
      }`}
    >
      {activity.status}
    </span>
  ) : null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-[calc(100svh-4rem)] overflow-hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/activities"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Activities</span>
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <span className="max-w-50 truncate text-sm text-gray-400">
            {formData.title || "Untitled"}
          </span>

          {statusBadge}
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
            Update
          </Button>

          {activity?.status !== "published" && (
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

          <div className="mx-auto max-w-[720px] px-6 py-10 sm:px-12 lg:px-16">
            <Textarea
              ref={titleRef}
              value={formData.title}
              onChange={autoResizeTitle}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled activity"
              className="mb-2 text-5xl! w-full min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-[2.5rem] font-bold leading-tight text-gray-900 placeholder-gray-200 shadow-none focus-visible:ring-0"
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
              placeholder="Add a brief activity summary..."
              className="mb-8 w-full min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-lg leading-relaxed text-gray-400 placeholder-gray-200 shadow-none focus-visible:ring-0"
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
              placeholder="Write activity details..."
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
                  Activity Settings
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

              {activity && (
                <div className="mb-5">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Status
                  </label>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] capitalize text-gray-700 shadow-sm">
                    {activity.status}
                  </div>
                </div>
              )}

              <Separator className="my-4 bg-gray-200/80" />

              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Visibility
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      is_featured: !prev.is_featured,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    formData.is_featured
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {formData.is_featured
                    ? "Featured activity"
                    : "Regular activity"}
                </button>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  Featured activities appear prominently on the homepage.
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

              <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-gray-400">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  <div>
                    <p className="mb-1">
                      Use concise descriptions and clear activity instructions.
                    </p>
                    <p>
                      Include images inside the editor for richer activity
                      guides.
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
