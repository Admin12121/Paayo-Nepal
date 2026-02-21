import type { Metadata } from "next";
import Link from "@/components/ui/animated-link";
import { notFound } from "next/navigation";
import { Calendar, Eye, PlayCircle } from "lucide-react";
import {
  activitiesApi,
  attractionsApi,
  contentLinksApi,
  photoFeaturesApi,
  postsApi,
  regionsApi,
  videosApi,
  type Activity,
  type PhotoFeature,
  type Region,
  type Video,
} from "@/lib/api-client";
import { RegionMapPreview } from "@/components/maps/region-map-preview";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { normalizeMediaUrl } from "@/lib/media-url";
import { prepareContent } from "@/lib/sanitize";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  generateActivityJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo";
import { getPostPublicPath } from "@/lib/post-routes";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

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

function resolvePublisherName(activity: Activity) {
  const enriched = activity as Activity & {
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
    activity.content &&
    typeof activity.content === "object" &&
    !Array.isArray(activity.content)
      ? (activity.content as Record<string, unknown>)
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

function buildPhotoGalleryItems(photoFeatures: PhotoFeature[]): GalleryPhotoItem[] {
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

type RecommendationItem = {
  id: string;
  title: string;
  href: string;
  image: string | null;
  subtitle: string | null;
};

function AnchorTabs() {
  return (
    <nav className="mt-6 overflow-x-auto border-b border-[#E5E7EB]">
      <div className="flex min-w-max items-center gap-8 px-1">
        <a href="#overview" className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]">
          Overview
        </a>
        <a
          href="#top-recommendation"
          className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]"
        >
          Top Recommendation
        </a>
        <a href="#photos" className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]">
          Photos
        </a>
        <a href="#videos" className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]">
          Videos
        </a>
        <a href="#map" className="py-3 text-sm font-medium text-[#1A2B49] hover:text-[#0078C0]">
          Map
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
    const activity = await activitiesApi.getBySlug(slug);

    return {
      title: `${activity.title} - Activities in Nepal`,
      description:
        activity.short_description ||
        `Experience ${activity.title}, an exciting activity in Nepal`,
      openGraph: {
        title: activity.title,
        description:
          activity.short_description || `Experience ${activity.title} in Nepal`,
        url: `${BASE_URL}/activities/${slug}`,
        type: "article",
        images: activity.cover_image ? [activity.cover_image] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: activity.title,
        description:
          activity.short_description || `Experience ${activity.title} in Nepal`,
        images: activity.cover_image ? [activity.cover_image] : [],
      },
      alternates: {
        canonical: `${BASE_URL}/activities/${slug}`,
      },
    };
  } catch {
    return {
      title: "Activity Not Found",
    };
  }
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let activity: Activity;
  try {
    activity = await activitiesApi.getBySlug(slug);
  } catch {
    notFound();
  }

  const [linksResult, activitiesResult, regionsResult, photosResult, videosResult] =
    await Promise.allSettled([
      contentLinksApi.listForSource("post", activity.id),
      activitiesApi.list({ limit: 40, is_active: true }),
      regionsApi.list({ limit: 250, status: "published" }),
      photoFeaturesApi.list({ limit: 30, status: "published" }),
      videosApi.list({ limit: 30, status: "published", region_id: activity.region_id || undefined }),
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
      ? regionsResult.value.data.find((item) => item.id === activity.region_id) || null
      : null;

  const publishedActivities =
    activitiesResult.status === "fulfilled" ? activitiesResult.value.data : [];
  const sameRegionActivities = publishedActivities.filter(
    (item) =>
      item.id !== activity.id &&
      Boolean(activity.region_id) &&
      item.region_id === activity.region_id,
  );
  const otherActivities = publishedActivities.filter(
    (item) =>
      item.id !== activity.id &&
      (!activity.region_id || item.region_id !== activity.region_id),
  );
  const moreActivities = [...sameRegionActivities, ...otherActivities].slice(0, 12);

  const videosPool = videosResult.status === "fulfilled" ? videosResult.value.data : [];
  let regionVideos: Video[] = videosPool.filter((item) => item.id !== activity.id);

  if (linkedIds.videos.length > 0) {
    const linkedVideoResult = await Promise.allSettled(
      linkedIds.videos.map((id) => videosApi.getById(id)),
    );
    const order = new Map(linkedIds.videos.map((id, index) => [id, index]));
    const linkedVideos = linkedVideoResult
      .filter(
        (entry): entry is PromiseFulfilledResult<Video> => entry.status === "fulfilled",
      )
      .map((entry) => entry.value)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    if (linkedVideos.length > 0) {
      regionVideos = linkedVideos;
    }
  }

  const photosPool = photosResult.status === "fulfilled" ? photosResult.value.data : [];
  let regionPhotos = activity.region_id
    ? photosPool.filter((item) => item.region_id === activity.region_id)
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
      const linkedPostsResult = await postsApi.list({ limit: 120, status: "published" });
      const order = new Map(linkedIds.posts.map((id, index) => [id, index]));
      const linkedPosts = linkedPostsResult.data
        .filter((item) => item.id !== activity.id && order.has(item.id))
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

  if (recommendations.length === 0 && activity.region_id) {
    try {
      const attractionResult = await attractionsApi.list({
        limit: 8,
        region_id: activity.region_id,
      });
      recommendations = attractionResult.data.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.title,
        href: `/attractions/${item.slug}`,
        image: normalizeMediaUrl(item.cover_image),
        subtitle: item.short_description || null,
      }));
    } catch {
      recommendations = [];
    }
  }

  const coverImage = normalizeMediaUrl(activity.cover_image);
  const publisherName = resolvePublisherName(activity);
  const publishedDate = formatDate(activity.published_at || activity.created_at);
  const overviewHtml = activity.content ? prepareContent(activity.content) : "";
  const galleryPhotos = buildPhotoGalleryItems(regionPhotos);
  const leadPhoto = galleryPhotos[0]?.image || null;
  const leadPhotoTitle = galleryPhotos[0]?.title || `${activity.title} photo`;
  const gridPhotos = galleryPhotos.slice(1, 10);
  const leadVideo = regionVideos[0] || null;
  const sideVideos = regionVideos.slice(1, 9);

  const activityJsonLd = generateActivityJsonLd({
    title: activity.title,
    description: activity.short_description || undefined,
    slug: activity.slug,
    coverImage: coverImage,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Activities", href: "/activities" },
    { name: activity.title },
  ]);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <script {...jsonLdScriptProps(activityJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <ViewTracker targetType="post" targetId={activity.id} />

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0">
            <header>
              <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-[#1A2B49] md:text-5xl">
                {activity.title}
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
                    value={activity.views ?? activity.view_count ?? 0}
                    className="tracking-normal text-current dark:text-current"
                  />{" "}
                  views
                </span>
              </div>
              <div className="mt-4">
                <ShareButtons
                  title={activity.title}
                  description={activity.short_description || undefined}
                  compact
                />
              </div>
            </header>

            {coverImage ? (
              <section className="mt-6 overflow-hidden rounded-xl">
                <img
                  src={coverImage}
                  alt={activity.title}
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
                  {activity.short_description || "No overview content available."}
                </p>
              )}
            </section>

            <section id="top-recommendation" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                TOP RECOMMENDATION
              </h2>
              <p className="mt-2 text-[#4B5563]">
                Explore the best destination for trekking and plan your trips.
              </p>
              {recommendations.length > 0 ? (
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {recommendations.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group overflow-hidden rounded-lg border border-[#E5E7EB] bg-white"
                    >
                      <div className="h-44 w-full bg-[#E5E7EB]">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-[#6B7280]">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="line-clamp-2 text-sm font-semibold text-[#1A2B49]">
                          {item.title}
                        </h3>
                        {item.subtitle ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">
                            {item.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#6B7280]">No recommendations available.</p>
              )}
            </section>

            <section id="photos" className="pt-10">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                PHOTOS
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
                <p className="mt-5 text-sm text-[#6B7280]">No photos available.</p>
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
                        href="/photos"
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
                <p className="mt-5 text-sm text-[#6B7280]">No videos available.</p>
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
                  Map data for this activity region is not available.
                </p>
              )}
            </section>
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col p-4 lg:h-[calc(100vh-7rem)]">
              <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-[#1A2B49]">
                MORE ACTIVITIES
              </h3>

              <div className="mt-4 space-y-4 overflow-y-auto pr-1">
                {moreActivities.length > 0 ? (
                  moreActivities.map((item) => (
                    <Link
                      key={item.id}
                      href={`/activities/${item.slug}`}
                      className="group block overflow-hidden rounded-lg border border-[#E5E7EB]"
                    >
                      <div className="h-28 w-full bg-[#E5E7EB]">
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
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-sm font-medium text-[#1A2B49]">
                          {item.title}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280]">No related activities found.</p>
                )}
              </div>

              <Link
                href="/activities"
                className="mt-4 inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-[#0078C0] hover:text-[#00629C]"
              >
                VIEW ALL
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
