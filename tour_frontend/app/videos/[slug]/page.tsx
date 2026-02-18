"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import { Eye, Play, Calendar, ExternalLink } from "lucide-react";
import { videosApi, Video } from "@/lib/api-client";
import Link from "next/link";
import { useViewTracker } from "@/lib/hooks/use-view-tracker";
import { LikeButton } from "@/components/ui/LikeButton";
import { CommentSection } from "@/components/ui/CommentSection";
import { ShareButtons } from "@/components/ui/ShareButtons";

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-[#0078C0] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#0078C0] font-medium">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

function getEmbedUrl(
  platform: string,
  videoUrl: string,
  videoId: string | null,
): string | null {
  if (platform === "youtube") {
    const id = videoId || extractYouTubeId(videoUrl);
    if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
  }
  if (platform === "vimeo") {
    const id = videoId || extractVimeoId(videoUrl);
    if (id) return `https://player.vimeo.com/video/${id}`;
  }
  if (platform === "tiktok") {
    const id = videoId || extractTikTokId(videoUrl);
    if (id) return `https://www.tiktok.com/embed/v2/${id}`;
  }
  return null;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

function extractTikTokId(url: string): string | null {
  const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return match ? match[1] : null;
}

function RelatedVideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/videos/${video.slug}`}>
      <div className="group cursor-pointer">
        <div className="rounded-[10px] overflow-hidden aspect-video mb-2 relative bg-gray-200">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <Play className="w-8 h-8 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
              <Play className="w-4 h-4 text-gray-900 ml-0.5" />
            </div>
          </div>
          {video.duration && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
              {Math.floor(video.duration / 60)}:
              {String(video.duration % 60).padStart(2, "0")}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
          <span>
            {new Date(
              video.published_at || video.created_at,
            ).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {video.view_count}
          </span>
        </div>
        <h4 className="font-display text-sm font-semibold text-[#1A2B49] leading-snug line-clamp-2 group-hover:text-[#0078C0] transition-colors">
          {video.title}
        </h4>
      </div>
    </Link>
  );
}

export default function VideoDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the page view once the video is loaded
  useViewTracker("video", video?.id);

  useEffect(() => {
    if (slug) {
      fetchVideo();
      fetchRelatedVideos();
    }
  }, [slug]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await videosApi.getBySlug(slug);
      setVideo(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedVideos = async () => {
    try {
      const response = await videosApi.list({ limit: 6, status: "published" });
      setRelatedVideos(response.data.filter((v) => v.slug !== slug));
    } catch (err) {
      console.error("Failed to fetch related videos:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen pt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="aspect-video bg-gray-200 rounded-2xl mb-6" />
            <div className="h-6 bg-gray-200 rounded w-full mb-2" />
            <div className="h-6 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    notFound();
  }

  const embedUrl = getEmbedUrl(video.platform, video.video_url, video.video_id);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Videos", href: "/videos" },
            { label: video.title },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="mb-6">
              {embedUrl ? (
                <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                  <iframe
                    src={embedUrl}
                    title={video.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-2xl overflow-hidden bg-gray-900 flex flex-col items-center justify-center relative">
                  {video.thumbnail_url && (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-40"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center">
                    <Play className="w-16 h-16 text-white/70 mb-4" />
                    <a
                      href={video.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Watch on{" "}
                      {video.platform.charAt(0).toUpperCase() +
                        video.platform.slice(1)}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Video Header */}
            <div className="mb-6">
              <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#1A2B49] mb-3 leading-tight">
                {video.title}
              </h1>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 text-sm text-[#868383]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(
                      video.published_at || video.created_at,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span>|</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                    {video.platform}
                  </span>
                  {formatDuration(video.duration) && (
                    <>
                      <span>|</span>
                      <span>{formatDuration(video.duration)}</span>
                    </>
                  )}
                </div>
                <ShareButtons
                  title={video.title}
                  description={video.description || undefined}
                  compact
                />
              </div>
            </div>

            {/* Description */}
            {video.description && (
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-3">
                  Description
                </h3>
                <div className="text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                  {video.description}
                </div>
              </div>
            )}

            {/* Engagement Stats */}
            <div className="flex items-center justify-between flex-wrap gap-4 py-4 border-t border-b border-gray-200 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[#868383] text-sm">
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">
                    {video.view_count.toLocaleString()} views
                  </span>
                </div>
                <LikeButton
                  targetType="video"
                  targetId={video.id}
                  initialCount={video.like_count}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#0078C0] hover:text-[#0068A0] font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Watch on{" "}
                  {video.platform.charAt(0).toUpperCase() +
                    video.platform.slice(1)}
                </a>
                <ShareButtons
                  title={video.title}
                  description={video.description || undefined}
                  compact
                />
              </div>
            </div>

            {/* Comments Section */}
            <div className="mt-6">
              {video.id ? (
                <CommentSection targetType="video" targetId={video.id} />
              ) : null}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 rounded-xl bg-white p-5 shadow-sm h-fit">
            {relatedVideos.length > 0 && (
              <>
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-5 uppercase tracking-wide">
                  MORE VIDEOS
                </h3>
                <div className="space-y-4">
                  {relatedVideos.slice(0, 10).map((vid) => (
                    <RelatedVideoCard key={vid.id} video={vid} />
                  ))}
                </div>
                <Link
                  href="/videos"
                  className="mt-6 block text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0078C0] hover:text-[#0068A0]"
                >
                  View All
                </Link>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
