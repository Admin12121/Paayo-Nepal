"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Play, Eye } from "lucide-react";
import { videosApi, Video } from "@/lib/api-client";
import Link from "next/link";

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-5 flex items-center gap-2 text-xs text-[#6A7898]">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-[#0078C0]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#0078C0]">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatViews(count: number) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return count.toString();
}

function VideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/videos/${video.slug}`}>
      <article className="group overflow-hidden rounded-2xl bg-white shadow-[0_8px_22px_rgba(12,36,66,0.11)] transition-shadow hover:shadow-[0_12px_30px_rgba(12,36,66,0.16)]">
        <div className="relative aspect-video overflow-hidden bg-[#DCE2EE]">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#243B63]">
              <Play className="h-10 w-10 text-white/60" />
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90">
              <Play className="ml-0.5 h-5 w-5 text-[#1E2A3E]" />
            </div>
          </div>

          <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase text-[#4D5E7F]">
            {video.platform}
          </div>

          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
            <Eye className="h-3 w-3" />
            {formatViews(video.view_count)}
          </div>

          {video.duration ? (
            <div className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {formatDuration(video.duration)}
            </div>
          ) : null}
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-[#1A2B49] transition-colors group-hover:text-[#0078C0]">
            {video.title}
          </h3>
          {video.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-[#66789A]">{video.description}</p>
          ) : null}
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#7B89A2]">
            <span>
              {new Date(video.published_at || video.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>{video.like_count} likes</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function RailVideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/videos/${video.slug}`} className="group flex gap-3">
      <div className="relative h-[82px] w-[122px] shrink-0 overflow-hidden rounded-lg bg-[#DDE4EF]">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#243B63]">
            <Play className="h-6 w-6 text-white/60" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[#7B89A2]">
          {new Date(video.published_at || video.created_at).toLocaleDateString()}
        </p>
        <h4 className="line-clamp-2 text-sm font-semibold text-[#1A2B49] transition-colors group-hover:text-[#0078C0]">
          {video.title}
        </h4>
      </div>
    </Link>
  );
}

function VideoCardSkeleton() {
  return <div className="aspect-[4/3] animate-pulse rounded-2xl bg-[#DDE3EE]" />;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const limit = 12;

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const response = await videosApi.list({
          page: currentPage,
          limit,
          status: "published",
        });
        setVideos(response.data);
        setTotalPages(response.total_pages);
        setTotal(response.total);
      } catch (err) {
        console.error("Failed to load videos:", err);
        setVideos([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [currentPage]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setCurrentPage(1);
  };

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter(
      (video) =>
        video.title.toLowerCase().includes(q) ||
        video.description?.toLowerCase().includes(q),
    );
  }, [videos, searchQuery]);

  const railVideos = useMemo(
    () => [...videos].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 10),
    [videos],
  );

  return (
    <div className="min-h-screen bg-[#EEF1F6] pt-20">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Videos" }]} />

        <div className="mb-7">
          <h1 className="font-display text-[40px] font-semibold text-[#1A2B49] md:text-[46px]">Videos</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#6A7898] md:text-base">
            Watch stories and travel footage from across Nepal.
          </p>
        </div>

        <div className="mb-7 rounded-2xl bg-white p-5 shadow-[0_5px_20px_rgba(14,35,63,0.08)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-[#CCD5E4] bg-white px-4 py-2">
              <Search className="h-4 w-4 text-[#0078C0]" />
              <input
                type="text"
                placeholder="Search videos"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full bg-transparent text-sm text-[#273959] outline-none placeholder:text-[#8B99B2]"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-full bg-[#0078C0] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0569A6]"
            >
              Search
            </button>
          </div>
          <p className="mt-3 text-xs text-[#6A7898]">
            Showing {filteredVideos.length} of {total} video(s)
            {searchQuery ? ` for "${searchQuery}"` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {loading ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <VideoCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center">
                <h3 className="text-lg font-semibold text-[#1A2B49]">No Videos Found</h3>
                <p className="mt-1 text-sm text-[#6A7898]">Try another search keyword.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-md border border-[#D0D8E6] px-4 py-2 text-sm text-[#4A5D7E] disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`h-9 w-9 rounded-md text-sm font-semibold ${
                          page === currentPage
                            ? "bg-[#0078C0] text-white"
                            : "text-[#4A5D7E] hover:bg-[#E7EEF7]"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-md border border-[#D0D8E6] px-4 py-2 text-sm text-[#4A5D7E] disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <aside className="h-fit rounded-2xl bg-white p-5 shadow-[0_8px_22px_rgba(12,36,66,0.11)]">
            <h3 className="mb-4 font-display text-lg font-semibold uppercase tracking-[0.08em] text-[#1A2B49]">
              More Videos
            </h3>
            <div className="space-y-4">
              {railVideos.map((video) => (
                <RailVideoCard key={video.id} video={video} />
              ))}
            </div>
            <div className="mt-4 text-right">
              <Link href="/videos" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#008CFF]">
                View All
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
