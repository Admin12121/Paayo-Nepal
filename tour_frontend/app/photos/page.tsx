"use client";

import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Download,
  Heart,
  Link2,
  Search,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import {
  photoFeaturesApi,
  type PhotoFeature,
  type PhotoImage,
} from "@/lib/api-client";
import { normalizeMediaUrl } from "@/lib/media-url";

type GalleryItem = {
  id: string;
  imageUrl: string;
  title: string;
  editorName: string;
  collectionTitle: string;
  description: string | null;
  publishedAt: string;
};

type FeatureWithAuthorMeta = PhotoFeature & {
  author_name?: string | null;
  editor_name?: string | null;
  writer_name?: string | null;
  publisher_name?: string | null;
  created_by_name?: string | null;
  author?: {
    name?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

type ImageWithAuthorMeta = PhotoImage & {
  uploaded_by_name?: string | null;
  uploader_name?: string | null;
  editor_name?: string | null;
  uploaded_by_user?: {
    name?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

const SAVED_PHOTOS_KEY = "paayo:saved-photo-ids";
const LIKED_PHOTOS_KEY = "paayo:liked-photo-ids";

function looksLikeSystemIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const longHexPattern = /^[0-9a-f]{16,}$/i;
  const tokenPattern = /^[a-z0-9_-]{20,}$/i;

  return (
    uuidPattern.test(trimmed) ||
    longHexPattern.test(trimmed) ||
    tokenPattern.test(trimmed)
  );
}

function resolveEditorName(feature: PhotoFeature, image?: PhotoImage | null): string {
  const featureMeta = feature as FeatureWithAuthorMeta;
  const imageMeta = image as ImageWithAuthorMeta | undefined;

  const candidates = [
    imageMeta?.uploaded_by_name,
    imageMeta?.uploader_name,
    imageMeta?.editor_name,
    imageMeta?.uploaded_by_user?.display_name,
    imageMeta?.uploaded_by_user?.full_name,
    imageMeta?.uploaded_by_user?.name,
    featureMeta.author_name,
    featureMeta.editor_name,
    featureMeta.writer_name,
    featureMeta.publisher_name,
    featureMeta.created_by_name,
    featureMeta.author?.display_name,
    featureMeta.author?.full_name,
    featureMeta.author?.name,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (!normalized) continue;
    if (looksLikeSystemIdentifier(normalized)) continue;
    return normalized;
  }

  return "Paayo Editor";
}

function toGalleryItem(
  feature: PhotoFeature,
  imageUrl: string,
  imageId: string,
  caption: string | null,
  editorName: string,
): GalleryItem {
  return {
    id: `${feature.id}-${imageId}`,
    imageUrl,
    title: caption?.trim() || feature.title,
    editorName,
    collectionTitle: feature.title,
    description: feature.description,
    publishedAt: feature.published_at || feature.created_at,
  };
}

async function resolveFeatureImages(feature: PhotoFeature): Promise<GalleryItem[]> {
  const featureWithImages = feature as PhotoFeature & { images?: PhotoImage[] };
  const fromPayload =
    featureWithImages.images && featureWithImages.images.length > 0
      ? [...featureWithImages.images]
          .sort((a, b) => a.display_order - b.display_order)
          .map((image, index) => {
            const normalized = normalizeMediaUrl(image.image_url);
            if (!normalized) return null;
            return toGalleryItem(
              feature,
              normalized,
              image.id || String(index),
              image.caption,
              resolveEditorName(feature, image),
            );
          })
          .filter((item): item is GalleryItem => item !== null)
      : [];

  if (fromPayload.length > 0) return fromPayload;

  try {
    const images = await photoFeaturesApi.listImages(feature.id);
    const fromImages = [...images]
      .sort((a, b) => a.display_order - b.display_order)
      .map((image, index) => {
        const normalized = normalizeMediaUrl(image.image_url);
        if (!normalized) return null;
        return toGalleryItem(
          feature,
          normalized,
          image.id || String(index),
          image.caption,
          resolveEditorName(feature, image),
        );
      })
      .filter((item): item is GalleryItem => item !== null);

    if (fromImages.length > 0) return fromImages;
  } catch {
    // Ignore and use cover fallback.
  }

  const fallbackCover = normalizeMediaUrl(feature.cover_image_url);
  if (!fallbackCover) return [];

  return [
    toGalleryItem(
      feature,
      fallbackCover,
      "cover",
      feature.title,
      resolveEditorName(feature, null),
    ),
  ];
}

function getHeightClass(index: number): string {
  const heights = [
    "h-56",
    "h-72",
    "h-[28rem]",
    "h-64",
    "h-80",
    "h-[30rem]",
    "h-60",
    "h-96",
  ];
  return heights[index % heights.length];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function MasonrySkeleton() {
  return (
    <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
      {Array.from({ length: 15 }).map((_, index) => (
        <div key={index} className="mb-4 break-inside-avoid">
          <div
            className={`w-full animate-pulse rounded-2xl bg-gray-200 ${getHeightClass(
              index,
            )}`}
          />
        </div>
      ))}
    </div>
  );
}

function initialsFromName(name: string): string {
  const tokens = name.split(" ").filter(Boolean);
  if (tokens.length === 0) return "PE";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(18);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([]);
  const [likedPhotoIds, setLikedPhotoIds] = useState<string[]>([]);
  const [copiedPhotoId, setCopiedPhotoId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        setLoading(true);
        const response = await photoFeaturesApi.list({
          limit: 36,
          status: "published",
        });

        const mapped = await Promise.all(
          response.data.map(async (feature) => resolveFeatureImages(feature)),
        );

        setPhotos(mapped.flat());
      } catch (err) {
        console.error("Failed to load photos:", err);
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchGallery();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedRaw = window.localStorage.getItem(SAVED_PHOTOS_KEY);
      const likedRaw = window.localStorage.getItem(LIKED_PHOTOS_KEY);

      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) {
          setSavedPhotoIds(parsed.filter((item) => typeof item === "string"));
        }
      }

      if (likedRaw) {
        const parsed = JSON.parse(likedRaw);
        if (Array.isArray(parsed)) {
          setLikedPhotoIds(parsed.filter((item) => typeof item === "string"));
        }
      }
    } catch {
      setSavedPhotoIds([]);
      setLikedPhotoIds([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SAVED_PHOTOS_KEY, JSON.stringify(savedPhotoIds));
  }, [savedPhotoIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LIKED_PHOTOS_KEY, JSON.stringify(likedPhotoIds));
  }, [likedPhotoIds]);

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return photos;

    return photos.filter(
      (photo) =>
        photo.title.toLowerCase().includes(q) ||
        photo.editorName.toLowerCase().includes(q) ||
        photo.collectionTitle.toLowerCase().includes(q),
    );
  }, [photos, searchQuery]);

  useEffect(() => {
    setVisibleCount(18);
  }, [searchQuery]);

  const visiblePhotos = useMemo(
    () => filteredPhotos.slice(0, visibleCount),
    [filteredPhotos, visibleCount],
  );

  const selectedPhoto = useMemo(
    () => filteredPhotos.find((photo) => photo.id === selectedPhotoId) || null,
    [filteredPhotos, selectedPhotoId],
  );

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedPhotoId) return -1;
    return filteredPhotos.findIndex((photo) => photo.id === selectedPhotoId);
  }, [filteredPhotos, selectedPhotoId]);

  const savedPhotoSet = useMemo(() => new Set(savedPhotoIds), [savedPhotoIds]);
  const likedPhotoSet = useMemo(() => new Set(likedPhotoIds), [likedPhotoIds]);

  const canLoadMore = visibleCount < filteredPhotos.length;
  const headerPreviews = photos.slice(0, 2);

  const closeDialog = useCallback(() => setSelectedPhotoId(null), []);

  const goNext = useCallback(() => {
    if (selectedPhotoIndex < 0 || filteredPhotos.length === 0) return;
    const nextIndex = (selectedPhotoIndex + 1) % filteredPhotos.length;
    setSelectedPhotoId(filteredPhotos[nextIndex]?.id ?? null);
  }, [filteredPhotos, selectedPhotoIndex]);

  const goPrev = useCallback(() => {
    if (selectedPhotoIndex < 0 || filteredPhotos.length === 0) return;
    const prevIndex =
      (selectedPhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPhotoId(filteredPhotos[prevIndex]?.id ?? null);
  }, [filteredPhotos, selectedPhotoIndex]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const toggleSavedPhoto = useCallback(
    (photoId: string, event?: MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      setSavedPhotoIds((prev) =>
        prev.includes(photoId)
          ? prev.filter((id) => id !== photoId)
          : [...prev, photoId],
      );
    },
    [],
  );

  const toggleLikedPhoto = useCallback(
    (photoId: string, event?: MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      setLikedPhotoIds((prev) =>
        prev.includes(photoId)
          ? prev.filter((id) => id !== photoId)
          : [...prev, photoId],
      );
    },
    [],
  );

  const buildShareUrl = useCallback((photoId: string) => {
    if (typeof window === "undefined") {
      return `/photos?photo=${encodeURIComponent(photoId)}`;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("photo", photoId);
    return url.toString();
  }, []);

  const handleSharePhoto = useCallback(
    async (photo: GalleryItem, event?: MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      const shareUrl = buildShareUrl(photo.id);

      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({
            title: photo.title,
            text: `Photo by ${photo.editorName}`,
            url: shareUrl,
          });
          return;
        } catch {
          // Fall back to clipboard.
        }
      }

      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
        } else if (typeof window !== "undefined") {
          const input = window.document.createElement("textarea");
          input.value = shareUrl;
          input.style.position = "fixed";
          input.style.opacity = "0";
          window.document.body.appendChild(input);
          input.select();
          window.document.execCommand("copy");
          input.remove();
        }
        setCopiedPhotoId(photo.id);
        toast.success("Photo link copied");
        window.setTimeout(() => setCopiedPhotoId(null), 1200);
      } catch {
        toast.error("Unable to copy link");
      }
    },
    [buildShareUrl],
  );

  const handleOpenImageLink = useCallback(
    (photo: GalleryItem, event?: MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      if (typeof window === "undefined") return;
      window.open(photo.imageUrl, "_blank", "noopener,noreferrer");
    },
    [],
  );

  const handleDownloadPhoto = useCallback(
    (photo: GalleryItem, event?: MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      if (typeof window === "undefined") return;

      const fileName = slugify(photo.title || "photo");
      const anchor = window.document.createElement("a");
      anchor.href = photo.imageUrl;
      anchor.download = `${fileName || "photo"}.jpg`;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [],
  );

  useEffect(() => {
    if (selectedPhotoId && !filteredPhotos.some((photo) => photo.id === selectedPhotoId)) {
      setSelectedPhotoId(null);
    }
  }, [filteredPhotos, selectedPhotoId]);

  useEffect(() => {
    if (loading || selectedPhotoId || photos.length === 0) return;
    if (typeof window === "undefined") return;

    const photoParam = new URLSearchParams(window.location.search).get("photo");
    if (!photoParam) return;

    const index = filteredPhotos.findIndex((photo) => photo.id === photoParam);
    if (index < 0) return;

    if (index + 1 > visibleCount) {
      setVisibleCount(index + 1);
    }
    setSelectedPhotoId(filteredPhotos[index].id);
  }, [filteredPhotos, loading, photos.length, selectedPhotoId, visibleCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    if (selectedPhotoId) {
      url.searchParams.set("photo", selectedPhotoId);
    } else {
      url.searchParams.delete("photo");
    }

    window.history.replaceState(window.history.state, "", url.toString());
  }, [selectedPhotoId]);

  useEffect(() => {
    if (selectedPhoto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPhoto]);

  useEffect(() => {
    if (!selectedPhoto) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPhoto, closeDialog, goNext, goPrev]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] pt-24">
      <div className="mx-auto max-w-[1120px] px-4 pb-12">
        <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_240px]">
          <div>
            <h1 className="max-w-[720px] text-4xl font-semibold leading-[1.05] text-[#111111] md:text-5xl">
              The best free stock photos, royalty-free images shared by creators.
            </h1>

            <form
              className="mt-4 flex items-center rounded-lg bg-white px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
            >
              <div className="mr-3 hidden items-center gap-1 rounded-md bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#374151] md:inline-flex">
                Photos
                <ChevronDown className="h-3 w-3" />
              </div>
              <input
                type="text"
                placeholder="Search for free photos"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]"
              />
              <button
                type="submit"
                className="ml-3 inline-flex items-center justify-center text-[#6B7280]"
                aria-label="Search photos"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="hidden grid-cols-2 gap-3 lg:grid">
            {headerPreviews.map((photo) => (
              <div
                key={`hero-${photo.id}`}
                className="relative h-40 overflow-hidden rounded-xl"
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/25" />
                <p className="absolute bottom-2 left-2 right-2 line-clamp-2 text-xs font-medium text-white">
                  {photo.title}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 overflow-x-auto text-xs text-[#4B5563]">
            <span className="rounded-full bg-black px-3 py-1.5 font-semibold text-white">
              Home
            </span>
            <span>Videos</span>
            <span>Leaderboard</span>
            <span>Challenges</span>
            <span>Winners Wall</span>
          </div>
          <button className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs text-[#374151]">
            Trending
            <ChevronDown className="h-3 w-3" />
          </button>
        </section>

        <h2 className="mb-5 text-xl font-semibold text-[#111111]">
          Explore Nepal from Photos
        </h2>

        {loading ? (
          <MasonrySkeleton />
        ) : visiblePhotos.length === 0 ? (
          <div className="py-16 text-center">
            <h3 className="text-xl font-semibold text-gray-900">No Photos Found</h3>
            <p className="mt-2 text-gray-600">No content available for this query.</p>
          </div>
        ) : (
          <>
            <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
              {visiblePhotos.map((photo, index) => {
                const isSaved = savedPhotoSet.has(photo.id);
                const isLiked = likedPhotoSet.has(photo.id);

                return (
                  <article
                    key={photo.id}
                    className="group mb-4 break-inside-avoid"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPhotoId(photo.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedPhotoId(photo.id);
                      }
                    }}
                  >
                    <div className="relative cursor-zoom-in overflow-hidden rounded-2xl">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        loading="lazy"
                        className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${getHeightClass(
                          index,
                        )}`}
                      />

                      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />

                      <div className="absolute inset-x-3 top-3 flex items-center justify-end gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label={isSaved ? "Unsave photo" : "Save photo"}
                          className="rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm"
                          onClick={(event) => toggleSavedPhoto(photo.id, event)}
                        >
                          <Bookmark
                            className={`h-3.5 w-3.5 ${isSaved ? "fill-white" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          aria-label="Copy link"
                          className="rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm"
                          onClick={(event) => {
                            void handleSharePhoto(photo, event);
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={isLiked ? "Unlike photo" : "Like photo"}
                          className="rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm"
                          onClick={(event) => toggleLikedPhoto(photo.id, event)}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${isLiked ? "fill-white" : ""}`}
                          />
                        </button>
                      </div>

                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                        <div className="min-w-0 text-white">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold backdrop-blur-sm">
                              {initialsFromName(photo.editorName)}
                            </span>
                            <p className="truncate text-sm font-semibold">
                              {photo.editorName}
                            </p>
                          </div>
                          <p className="truncate text-xs text-white/85">{photo.title}</p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/75 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                          onClick={(event) => handleDownloadPhoto(photo, event)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {canLoadMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className="rounded-md bg-white px-4 py-2 text-xs font-medium text-[#111827]"
                >
                  Load More
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-[70] bg-black/60 p-3 md:p-5"
          onClick={closeDialog}
        >
          <div
            className="mx-auto flex h-full w-full max-w-[1420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 md:px-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700"
                  aria-label="Close dialog"
                >
                  <CircleX className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">
                    {selectedPhoto.editorName}
                  </p>
                  <p className="truncate text-xs text-[#6B7280]">
                    {selectedPhoto.collectionTitle}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs ${
                    savedPhotoSet.has(selectedPhoto.id)
                      ? "border-[#0A79C1] bg-[#E7F2FC] text-[#0A79C1]"
                      : "border-gray-200 bg-white text-[#374151]"
                  }`}
                  onClick={(event) => toggleSavedPhoto(selectedPhoto.id, event)}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {savedPhotoSet.has(selectedPhoto.id) ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-[#374151]"
                  onClick={(event) => {
                    void handleSharePhoto(selectedPhoto, event);
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {copiedPhotoId === selectedPhoto.id ? "Copied" : "Share"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-[#374151]"
                  onClick={(event) => handleOpenImageLink(selectedPhoto, event)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Open
                </button>
                <button
                  type="button"
                  onClick={(event) => handleDownloadPhoto(selectedPhoto, event)}
                  className="inline-flex items-center gap-1 rounded-md bg-[#22c55e] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Free download
                </button>
              </div>
            </div>

            <div className="relative grid flex-1 gap-4 overflow-hidden bg-[#F7F8FA] p-4 md:grid-cols-[1fr_320px] md:p-5">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-[#111827] shadow-sm md:inline-flex"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                aria-label="Next photo"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-[#111827] shadow-sm md:right-[334px] md:inline-flex"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="flex min-h-0 items-center justify-center overflow-auto rounded-xl border border-gray-200 bg-white">
                <img
                  src={selectedPhoto.imageUrl}
                  alt={selectedPhoto.title}
                  className="max-h-full w-auto max-w-full object-contain"
                />
              </div>

              <aside className="flex min-h-0 flex-col overflow-auto rounded-xl border border-gray-200 bg-white p-4 text-[#111827]">
                <h3 className="line-clamp-2 text-lg font-semibold">
                  {selectedPhoto.title}
                </h3>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Uploaded by {selectedPhoto.editorName}
                </p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Published {formatDate(selectedPhoto.publishedAt)}
                </p>

                <div className="mt-5 space-y-2 text-sm text-[#4B5563]">
                  <p>
                    <span className="text-[#6B7280]">Collection:</span>{" "}
                    {selectedPhoto.collectionTitle}
                  </p>
                  <p>
                    <span className="text-[#6B7280]">Type:</span> Free to view
                  </p>
                  <p>
                    <span className="text-[#6B7280]">Use:</span> Personal and
                    editorial
                  </p>
                </div>

                <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm text-[#4B5563]">
                  {selectedPhoto.description?.trim() ||
                    "No description provided by the editor for this photo."}
                </div>

                <div className="mt-auto grid gap-2 pt-5">
                  <button
                    type="button"
                    onClick={(event) => handleDownloadPhoto(selectedPhoto, event)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Download className="h-4 w-4" />
                    Download original
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#374151]"
                    onClick={(event) => {
                      void handleSharePhoto(selectedPhoto, event);
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    {copiedPhotoId === selectedPhoto.id ? "Copied" : "Share"}
                  </button>
                </div>
              </aside>
            </div>

            <div className="border-t border-gray-200 px-4 py-3 md:px-5">
              <p className="mb-2 text-sm font-semibold text-[#111827]">More like this</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filteredPhotos
                  .filter((item) => item.id !== selectedPhoto.id)
                  .slice(0, 10)
                  .map((item) => (
                    <button
                      type="button"
                      key={`more-${item.id}`}
                      onClick={() => setSelectedPhotoId(item.id)}
                      className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-gray-200"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
