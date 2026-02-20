"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/animated-link";
import { ChevronDown, Eye, Play, Search } from "lucide-react";
import { videosApi, type Video } from "@/lib/api-client";
import { normalizeMediaUrl } from "@/lib/media-url";
import { NumberTicker } from "@/components/ui/number-ticker";

type SortMode = "trending" | "relevant" | "latest" | "oldest" | "title";

function getHeightClass(index: number): string {
  const heights = ["h-56", "h-72", "h-[28rem]", "h-64", "h-80", "h-96", "h-60"];
  return heights[index % heights.length];
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function MasonrySkeleton() {
  return (
    <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
      {Array.from({ length: 12 }).map((_, index) => (
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

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(18);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("trending");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get("search")?.trim() || "";
    const initialSort = (params.get("sort")?.trim() || "").toLowerCase();

    if (initialSearch) {
      setSearchInput(initialSearch);
      setSearchQuery(initialSearch);
    }

    if (
      initialSort === "trending" ||
      initialSort === "relevant" ||
      initialSort === "latest" ||
      initialSort === "oldest" ||
      initialSort === "title"
    ) {
      setSortMode(initialSort);
    }
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const response = await videosApi.list({ limit: 72, status: "published" });
        setVideos(response.data);
      } catch (error) {
        console.error("Failed to load videos:", error);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchVideos();
  }, []);

  useEffect(() => {
    setVisibleCount(18);
  }, [searchQuery, sortMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    if (searchQuery.trim()) {
      url.searchParams.set("search", searchQuery.trim());
    } else {
      url.searchParams.delete("search");
    }

    if (sortMode !== "trending") {
      url.searchParams.set("sort", sortMode);
    } else {
      url.searchParams.delete("sort");
    }

    window.history.replaceState(window.history.state, "", url.toString());
  }, [searchQuery, sortMode]);

  const filteredVideos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return videos;

    return videos.filter(
      (video) =>
        video.title.toLowerCase().includes(query) ||
        (video.description || "").toLowerCase().includes(query) ||
        video.platform.toLowerCase().includes(query),
    );
  }, [videos, searchQuery]);

  const sortedVideos = useMemo(() => {
    if (sortMode === "latest") {
      return [...filteredVideos].sort(
        (a, b) =>
          toTimestamp(b.published_at || b.created_at) -
          toTimestamp(a.published_at || a.created_at),
      );
    }

    if (sortMode === "oldest") {
      return [...filteredVideos].sort(
        (a, b) =>
          toTimestamp(a.published_at || a.created_at) -
          toTimestamp(b.published_at || b.created_at),
      );
    }

    if (sortMode === "title") {
      return [...filteredVideos].sort((a, b) =>
        a.title.localeCompare(b.title, "en-US", { sensitivity: "base" }),
      );
    }

    if (sortMode === "relevant") {
      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return [...filteredVideos].sort((a, b) => b.view_count - a.view_count);
      }

      return [...filteredVideos]
        .map((video) => {
          const title = video.title.toLowerCase();
          const description = (video.description || "").toLowerCase();
          const platform = video.platform.toLowerCase();

          let score = 0;
          if (title === query) score += 5;
          if (title.startsWith(query)) score += 3;
          if (title.includes(query)) score += 2;
          if (description.includes(query)) score += 1;
          if (platform.includes(query)) score += 1;

          return { video, score };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.video.view_count - a.video.view_count;
        })
        .map((entry) => entry.video);
    }

    return [...filteredVideos].sort((a, b) => {
      const aScore = (a.view_count || 0) + (a.like_count || 0) * 5;
      const bScore = (b.view_count || 0) + (b.like_count || 0) * 5;
      if (bScore !== aScore) return bScore - aScore;
      return (
        toTimestamp(b.published_at || b.created_at) -
        toTimestamp(a.published_at || a.created_at)
      );
    });
  }, [filteredVideos, searchQuery, sortMode]);

  const visibleVideos = useMemo(
    () => sortedVideos.slice(0, visibleCount),
    [sortedVideos, visibleCount],
  );

  const headerPreviews = useMemo(() => sortedVideos.slice(0, 2), [sortedVideos]);
  const canLoadMore = visibleCount < sortedVideos.length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pt-24">
      <div className="mx-auto max-w-[1120px] px-4 pb-12">
        <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_240px]">
          <div>
            <h1 className="max-w-[720px] text-4xl font-semibold leading-[1.05] text-[#111111] md:text-5xl">
              Watch destination videos and travel stories shared by creators.
            </h1>

            <form
              className="mt-4 flex items-center rounded-lg bg-white px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchQuery(searchInput);
              }}
            >
              <div className="mr-3 hidden items-center gap-1 rounded-md bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#374151] md:inline-flex">
                Videos
                <ChevronDown className="h-3 w-3" />
              </div>
              <input
                type="text"
                placeholder="Search videos"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]"
              />
              <button
                type="submit"
                className="ml-3 inline-flex items-center justify-center text-[#6B7280]"
                aria-label="Search videos"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="hidden grid-cols-2 gap-3 lg:grid">
            {headerPreviews.map((video) => (
              <Link
                key={`hero-${video.id}`}
                href={`/videos/${video.slug}`}
                className="relative h-40 overflow-hidden rounded-xl"
              >
                {normalizeMediaUrl(video.thumbnail_url) ? (
                  <img
                    src={normalizeMediaUrl(video.thumbnail_url) || ""}
                    alt={video.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-[#1F2937]" />
                )}
                <div className="absolute inset-0 bg-black/25" />
                <p className="absolute bottom-2 left-2 right-2 line-clamp-2 text-xs font-medium text-white">
                  {video.title}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-6 flex items-center justify-between gap-3">
          <p className="text-xs text-[#4B5563]">
            <NumberTicker
              value={sortedVideos.length}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            video
            {sortedVideos.length === 1 ? "" : "s"}
          </p>
          <div className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5">
            <label htmlFor="video-sort" className="text-xs text-[#6B7280]">
              Sort by
            </label>
            <select
              id="video-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="bg-transparent text-xs font-medium text-[#111827] outline-none"
            >
              <option value="trending">Trending</option>
              <option value="relevant">Relevant</option>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </section>

        <h2 className="mb-5 text-xl font-semibold text-[#111111]">
          Explore Nepal from Videos
        </h2>

        {loading ? (
          <MasonrySkeleton />
        ) : visibleVideos.length === 0 ? (
          <div className="py-16 text-center">
            <h3 className="text-xl font-semibold text-gray-900">No Videos Found</h3>
            <p className="mt-2 text-gray-600">No content available for this query.</p>
          </div>
        ) : (
          <>
            <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
              {visibleVideos.map((video, index) => (
                <Link
                  key={video.id}
                  href={`/videos/${video.slug}`}
                  className="group mb-4 block break-inside-avoid"
                >
                  <article className="relative overflow-hidden rounded-2xl">
                    {normalizeMediaUrl(video.thumbnail_url) ? (
                      <img
                        src={normalizeMediaUrl(video.thumbnail_url) || ""}
                        alt={video.title}
                        loading="lazy"
                        className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${getHeightClass(
                          index,
                        )}`}
                      />
                    ) : (
                      <div
                        className={`flex w-full items-center justify-center bg-[#1F2937] ${getHeightClass(
                          index,
                        )}`}
                      >
                        <Play className="h-10 w-10 text-white/70" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
                      <Eye className="h-3 w-3" />
                      <NumberTicker
                        value={video.view_count ?? 0}
                        className="tracking-normal text-current dark:text-current"
                      />
                    </div>

                    <div className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                      {video.platform}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <h3 className="line-clamp-2 text-sm font-semibold">
                        {video.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-white/85">
                        {new Date(
                          video.published_at || video.created_at,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {formatDuration(video.duration)
                          ? ` | ${formatDuration(video.duration)}`
                          : ""}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {canLoadMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setVisibleCount((previous) => previous + 12)}
                  className="rounded-md bg-white px-4 py-2 text-xs font-medium text-[#111827]"
                >
                  Load More
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
