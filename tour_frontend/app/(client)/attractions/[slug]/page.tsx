import type { Metadata } from "next";
import Link from "@/components/ui/animated-link";
import { notFound } from "next/navigation";
import { Calendar, Eye, PlayCircle } from "lucide-react";
import {
  attractionsApi,
  contentLinksApi,
  photoFeaturesApi,
  postsApi,
  regionsApi,
  videosApi,
  type Attraction,
  type PhotoFeature,
  type Region,
  type Video,
} from "@/lib/api-client";
import {
  ActivitiesAccordion,
  type ActivityAccordionItem,
} from "@/components/attractions/activities-accordion";
import { RegionMapPreview } from "@/components/maps/region-map-preview";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { normalizeMediaUrl } from "@/lib/media-url";
import { prepareContent } from "@/lib/sanitize";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  generateAttractionJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo";
import { getPostPublicPath } from "@/lib/post-routes";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "";
  const total = Math.floor(seconds);
  const hour = Math.floor(total / 3600);
  const minute = Math.floor((total % 3600) / 60);
  const second = total % 60;
  if (hour > 0) {
    return `${hour}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  }
  return `${minute}:${String(second).padStart(2, "0")}`;
}

function looksLikeSystemIdentifier(value: string) {
  const normalized = value.trim();
  if (!normalized) return true;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const tokenPattern = /^[a-z0-9_-]{20,}$/i;
  return uuidPattern.test(normalized) || tokenPattern.test(normalized);
}

function resolvePublisherName(attraction: Attraction) {
  const enriched = attraction as Attraction & {
    author_name?: string | null;
    editor_name?: string | null;
    writer_name?: string | null;
    publisher_name?: string | null;
    author?: {
      name?: string | null;
      full_name?: string | null;
      display_name?: string | null;
    } | null;
  };

  const content =
    attraction.content &&
    typeof attraction.content === "object" &&
    !Array.isArray(attraction.content)
      ? (attraction.content as Record<string, unknown>)
      : null;

  const candidates = [
    enriched.author_name,
    enriched.editor_name,
    enriched.writer_name,
    enriched.publisher_name,
    enriched.author?.display_name,
    enriched.author?.full_name,
    enriched.author?.name,
    content?.author_name,
    content?.authorName,
    content?.editor_name,
    content?.editorName,
    content?.writer_name,
    content?.writerName,
    content?.publisher_name,
    content?.publisherName,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (!value || looksLikeSystemIdentifier(value)) continue;
    return value;
  }

  return "Paayo Editor";
}

function resolvePhotoCover(photo: PhotoFeature) {
  const preferred = normalizeMediaUrl(photo.cover_image_url);
  if (preferred) return preferred;
  if (photo.images && photo.images.length > 0) {
    return normalizeMediaUrl(photo.images[0]?.image_url);
  }
  return null;
}

type GalleryPhotoItem = {
  id: string;
  title: string;
  image: string | null;
};

function buildPhotoGalleryItems(
  photoFeatures: PhotoFeature[],
): GalleryPhotoItem[] {
  const gallery: GalleryPhotoItem[] = [];

  for (const feature of photoFeatures) {
    const images = Array.isArray(feature.images) ? feature.images : [];

    if (images.length > 0) {
      for (let i = 0; i < images.length; i += 1) {
        const image = normalizeMediaUrl(images[i]?.image_url);
        if (!image) continue;
        gallery.push({
          id: `${feature.id}-${images[i]?.id || i}`,
          title: feature.title,
          image,
        });
      }
      continue;
    }

    const cover = resolvePhotoCover(feature);
    if (cover) {
      gallery.push({
        id: feature.id,
        title: feature.title,
        image: cover,
      });
    }
  }

  return gallery;
}

type RecommendationItem = ActivityAccordionItem;

function AnchorTabs() {
  return (
    <nav className="mt-6 overflow-x-auto border-b border-[#E5E7EB]">
      <div className="flex min-w-max items-center gap-8 px-1">
        <a
          href="#overview"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Overview
        </a>
        <a
          href="#activities"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Activities
        </a>
        <a
          href="#gallery"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Gallery
        </a>
        <a
          href="#map"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Map
        </a>
        <a
          href="#around"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Around
        </a>
        <a
          href="#nearby"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Nearby
        </a>
      </div>
    </nav>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const attraction = await attractionsApi.getBySlug(slug);
    const description =
      attraction.short_description ||
      `Discover ${attraction.title}, a must-visit attraction in Nepal`;

    return {
      title: `${attraction.title} - Nepal Attractions`,
      description,
      openGraph: {
        title: attraction.title,
        description,
        url: `${BASE_URL}/attractions/${slug}`,
        type: "article",
        images: attraction.cover_image ? [attraction.cover_image] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: attraction.title,
        description,
        images: attraction.cover_image ? [attraction.cover_image] : [],
      },
      alternates: {
        canonical: `${BASE_URL}/attractions/${slug}`,
      },
    };
  } catch {
    return {
      title: "Attraction Not Found",
    };
  }
}

export default async function AttractionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let attraction: Attraction;
  try {
    attraction = await attractionsApi.getBySlug(slug);
  } catch {
    notFound();
  }

  const [
    linksResult,
    attractionsResult,
    regionsResult,
    photosResult,
    videosResult,
  ] = await Promise.allSettled([
    contentLinksApi.listForSource("post", attraction.id),
    attractionsApi.list({ limit: 40 }),
    regionsApi.list({ limit: 250, status: "published" }),
    photoFeaturesApi.list({ limit: 30, status: "published" }),
    videosApi.list({
      limit: 30,
      status: "published",
      region_id: attraction.region_id || undefined,
    }),
  ]);

  const linkedIds = {
    posts: [] as string[],
    photos: [] as string[],
    videos: [] as string[],
  };

  if (linksResult.status === "fulfilled") {
    linkedIds.posts = linksResult.value
      .filter((item) => item.target_type === "post")
      .map((item) => item.target_id);
    linkedIds.photos = linksResult.value
      .filter((item) => item.target_type === "photo")
      .map((item) => item.target_id);
    linkedIds.videos = linksResult.value
      .filter((item) => item.target_type === "video")
      .map((item) => item.target_id);
  }

  const region: Region | null =
    regionsResult.status === "fulfilled"
      ? regionsResult.value.data.find(
          (item) => item.id === attraction.region_id,
        ) || null
      : null;

  const attractionPool =
    attractionsResult.status === "fulfilled"
      ? attractionsResult.value.data
      : [];
  const sameRegionAttractions = attractionPool.filter(
    (item) =>
      item.id !== attraction.id &&
      Boolean(attraction.region_id) &&
      item.region_id === attraction.region_id,
  );
  const otherAttractions = attractionPool.filter(
    (item) =>
      item.id !== attraction.id &&
      (!attraction.region_id || item.region_id !== attraction.region_id),
  );
  const moreAttractions = [...sameRegionAttractions, ...otherAttractions].slice(
    0,
    12,
  );

  const videosPool =
    videosResult.status === "fulfilled" ? videosResult.value.data : [];
  let regionVideos: Video[] = videosPool.filter(
    (item) => item.id !== attraction.id,
  );

  if (linkedIds.videos.length > 0) {
    const linkedVideoResult = await Promise.allSettled(
      linkedIds.videos.map((id) => videosApi.getById(id)),
    );
    const order = new Map(linkedIds.videos.map((id, index) => [id, index]));
    const linkedVideos = linkedVideoResult
      .filter(
        (entry): entry is PromiseFulfilledResult<Video> =>
          entry.status === "fulfilled",
      )
      .map((entry) => entry.value)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    if (linkedVideos.length > 0) {
      regionVideos = linkedVideos;
    }
  }

  const photosPool =
    photosResult.status === "fulfilled" ? photosResult.value.data : [];
  let regionPhotos = attraction.region_id
    ? photosPool.filter((item) => item.region_id === attraction.region_id)
    : photosPool;

  if (linkedIds.photos.length > 0) {
    const linkedPhotoResult = await Promise.allSettled(
      linkedIds.photos.map((id) => photoFeaturesApi.getById(id)),
    );
    const order = new Map(linkedIds.photos.map((id, index) => [id, index]));
    const linkedPhotos = linkedPhotoResult
      .filter(
        (entry): entry is PromiseFulfilledResult<PhotoFeature> =>
          entry.status === "fulfilled",
      )
      .map((entry) => entry.value)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    if (linkedPhotos.length > 0) {
      regionPhotos = linkedPhotos;
    }
  }

  let recommendations: RecommendationItem[] = [];

  if (linkedIds.posts.length > 0) {
    try {
      const linkedPostsResult = await postsApi.list({
        limit: 400,
        status: "published",
      });
      const order = new Map(linkedIds.posts.map((id, index) => [id, index]));
      const linkedPosts = linkedPostsResult.data
        .filter((item) => item.id !== attraction.id && order.has(item.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .slice(0, 6);

      recommendations = linkedPosts.map((item) => ({
        id: item.id,
        title: item.title,
        href: getPostPublicPath(item),
        image: normalizeMediaUrl(item.cover_image),
        subtitle: item.short_description || null,
      }));
    } catch {
      recommendations = [];
    }
  }

  if (recommendations.length === 0) {
    try {
      const activitiesResult = await postsApi.list({
        limit: 10,
        status: "published",
        type: "activity",
        region_id: attraction.region_id || undefined,
      });

      recommendations = activitiesResult.data.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.title,
        href: `/activities/${item.slug}`,
        image: normalizeMediaUrl(item.cover_image),
        subtitle: item.short_description || null,
      }));
    } catch {
      recommendations = [];
    }
  }

  const coverImage = normalizeMediaUrl(attraction.cover_image);
  const publisherName = resolvePublisherName(attraction);
  const publishedDate = formatDate(
    attraction.published_at || attraction.created_at,
  );
  const overviewHtml = attraction.content
    ? prepareContent(attraction.content)
    : "";
  const galleryPhotos = buildPhotoGalleryItems(regionPhotos);
  const leadPhoto = galleryPhotos[0]?.image || null;
  const leadPhotoTitle = galleryPhotos[0]?.title || `${attraction.title} photo`;
  const gridPhotos = galleryPhotos.slice(1, 10);
  const leadVideo = regionVideos[0] || null;
  const sideVideos = regionVideos.slice(1, 9);
  const aroundAttractions = sameRegionAttractions.slice(0, 6);
  const nearbyAttractions = otherAttractions.slice(0, 6);

  const attractionJsonLd = generateAttractionJsonLd({
    title: attraction.title,
    description:
      attraction.short_description || attraction.description || undefined,
    slug: attraction.slug,
    coverImage: coverImage,
    address: attraction.address,
    rating: attraction.rating,
    reviewCount: attraction.review_count,
    latitude: attraction.latitude,
    longitude: attraction.longitude,
    openingHours: attraction.opening_hours,
    entryFee: attraction.entry_fee,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Attractions", href: "/attractions" },
    { name: attraction.title },
  ]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pt-20">
      <script {...jsonLdScriptProps(attractionJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <ViewTracker targetType="post" targetId={attraction.id} />

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <article className="min-w-0 lg:col-span-2">
            <header>
              <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-[#1A2B49] md:text-5xl">
                {attraction.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#6B7280]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {publishedDate}
                </span>
                <span>|</span>
                <span>{publisherName}</span>
                <span>|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <NumberTicker
                    value={attraction.views ?? attraction.view_count ?? 0}
                    className="tracking-normal text-current dark:text-current"
                  />{" "}
                  views
                </span>
              </div>
              <div className="mt-4">
                <ShareButtons
                  title={attraction.title}
                  description={attraction.short_description || undefined}
                  compact
                />
              </div>
            </header>

            {coverImage ? (
              <section className="mt-6 overflow-hidden rounded-xl">
                <img
                  src={coverImage}
                  alt={attraction.title}
                  className="h-[420px] w-full object-cover md:h-[520px]"
                />
              </section>
            ) : null}

            <AnchorTabs />

            <section id="overview" className="pt-8">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                OVERVIEW
              </h2>
              {overviewHtml ? (
                <div
                  className="rich-content mt-5 max-w-none"
                  dangerouslySetInnerHTML={{ __html: overviewHtml }}
                />
              ) : (
                <p className="mt-5 leading-relaxed text-[#4B5563]">
                  {attraction.short_description ||
                    "No overview content available."}
                </p>
              )}
            </section>

            <ActivitiesAccordion items={recommendations} />

            <section id="gallery" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                GALLERY
              </h2>

              {leadPhoto ? (
                <div className="mt-5 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                  <img
                    src={leadPhoto}
                    alt={leadPhotoTitle}
                    className="h-[360px] w-full object-cover"
                  />
                  <div className="p-3 text-sm text-[#1A2B49]">
                    {(region?.name || "Nepal").trim()} photo gallery
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#6B7280]">
                  No photos available.
                </p>
              )}

              {gridPhotos.length > 0 ? (
                <>
                  <p className="mt-4 text-sm text-[#4B5563]">
                    {(region?.name || "Region").trim()} of Nepal
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {gridPhotos.map((item) => (
                      <Link
                        key={item.id}
                        href={`/photos?search=${encodeURIComponent(item.title)}`}
                        className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white"
                      >
                        <img
                          src={item.image || ""}
                          alt={item.title}
                          className="h-28 w-full object-cover md:h-32"
                        />
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <section id="videos" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                VIDEOS
              </h2>

              {leadVideo ? (
                <Link
                  href={`/videos/${leadVideo.slug}`}
                  className="mt-5 block overflow-hidden rounded-lg border border-[#E5E7EB] bg-white"
                >
                  <div className="relative h-[360px] w-full bg-[#E5E7EB]">
                    {normalizeMediaUrl(leadVideo.thumbnail_url) ? (
                      <img
                        src={normalizeMediaUrl(leadVideo.thumbnail_url) || ""}
                        alt={leadVideo.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-[#6B7280]">
                        No thumbnail
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                      {formatDuration(leadVideo.duration) || "Video"}
                    </div>
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 p-2">
                      <PlayCircle className="h-5 w-5 text-[#1A2B49]" />
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-[#1A2B49]">
                      {leadVideo.title}
                    </h3>
                    {leadVideo.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">
                        {leadVideo.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ) : (
                <p className="mt-5 text-sm text-[#6B7280]">
                  No videos available.
                </p>
              )}

              {sideVideos.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {sideVideos.map((item) => (
                    <Link
                      key={item.id}
                      href={`/videos/${item.slug}`}
                      className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white"
                    >
                      <div className="relative h-24 w-full bg-[#E5E7EB] md:h-28">
                        {normalizeMediaUrl(item.thumbnail_url) ? (
                          <img
                            src={normalizeMediaUrl(item.thumbnail_url) || ""}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                          {formatDuration(item.duration) || "Video"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>

            <section id="map" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                MAP
              </h2>
              {region ? (
                <div className="mt-5 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                  <RegionMapPreview
                    mapData={region.map_data}
                    province={region.province}
                    district={region.district}
                    latitude={region.latitude}
                    longitude={region.longitude}
                    className="h-[380px] w-full"
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#6B7280]">
                  Map data for this attraction region is not available.
                </p>
              )}
            </section>

            <section id="around" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                RELATED ATTRACTIONS
              </h2>
              {aroundAttractions.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {aroundAttractions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/attractions/${item.slug}`}
                      className="group block"
                    >
                      <div className="rounded-[10px] overflow-hidden aspect-video mb-2 relative">
                        {normalizeMediaUrl(item.cover_image) ? (
                          <img
                            src={normalizeMediaUrl(item.cover_image) || ""}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-[#6B7280]">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
                        <span>
                          {new Date(
                            item.published_at || item.created_at,
                          ).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <NumberTicker
                            value={item.views || 0}
                            className="tracking-normal text-current dark:text-current"
                          />
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-semibold text-[#F29C72] leading-snug uppercase tracking-wide line-clamp-2">
                        {item.title}
                      </h4>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#6B7280]">
                  No related attractions found for this region.
                </p>
              )}
            </section>

            <section id="nearby" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                ATTRACTIONS NEARBY
              </h2>
              {nearbyAttractions.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {nearbyAttractions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/attractions/${item.slug}`}
                      className="group block"
                    >
                      <div className="rounded-[10px] overflow-hidden aspect-video mb-2 relative">
                        {normalizeMediaUrl(item.cover_image) ? (
                          <img
                            src={normalizeMediaUrl(item.cover_image) || ""}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-[#6B7280]">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
                        <span>
                          {new Date(
                            item.published_at || item.created_at,
                          ).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <NumberTicker
                            value={item.views || 0}
                            className="tracking-normal text-current dark:text-current"
                          />
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-semibold text-[#F29C72] leading-snug uppercase tracking-wide line-clamp-2">
                        {item.title}
                      </h4>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#6B7280]">
                  No nearby attractions available right now.
                </p>
              )}
            </section>
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col p-5 lg:h-[calc(100vh-7rem)]">
              <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-5 uppercase tracking-wide">
                MORE ATTRACTIONS
              </h3>

              <div className="space-y-4 overflow-y-auto pr-1">
                {moreAttractions.length > 0 ? (
                  moreAttractions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/attractions/${item.slug}`}
                      className="group block"
                    >
                      <div className="rounded-[10px] overflow-hidden aspect-video mb-2 relative">
                        {normalizeMediaUrl(item.cover_image) ? (
                          <img
                            src={normalizeMediaUrl(item.cover_image) || ""}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-[#6B7280]">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
                        <span>
                          {new Date(
                            item.published_at || item.created_at,
                          ).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <NumberTicker
                            value={item.views || 0}
                            className="tracking-normal text-current dark:text-current"
                          />
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-semibold text-[#F29C72] leading-snug uppercase tracking-wide line-clamp-2">
                        {item.title}
                      </h4>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280]">
                    No related attractions found.
                  </p>
                )}
              </div>

              <Link
                href="/attractions"
                className="mt-4 block text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0078C0] hover:text-[#0068A0]"
              >
                View All
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
