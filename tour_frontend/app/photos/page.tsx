"use client";

import { useState, useEffect } from "react";
import { Search, Camera, Eye, Heart, Star } from "lucide-react";
import { photoFeaturesApi, PhotoFeature } from "@/lib/api-client";
import Link from "next/link";

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

function PhotoCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-4">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

function PhotoCard({ photo }: { photo: PhotoFeature }) {
  const coverImage =
    photo.images && photo.images.length > 0 ? photo.images[0].image_url : null;
  const imageCount = photo.images ? photo.images.length : 0;

  return (
    <Link href={`/photos/${photo.slug}`}>
      <div className="bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 group h-full flex flex-col">
        <div className="relative aspect-[4/3] bg-gray-200 overflow-hidden">
          {coverImage ? (
            <img
              src={coverImage}
              alt={photo.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <Camera className="w-12 h-12 text-gray-300" />
            </div>
          )}

          {/* Image count badge */}
          {imageCount > 0 && (
            <div className="absolute top-3 left-3 bg-black/70 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Camera className="w-3 h-3" />
              {imageCount} {imageCount === 1 ? "photo" : "photos"}
            </div>
          )}

          {/* Featured badge */}
          {photo.is_featured && (
            <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
          )}

          {/* View count */}
          <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-medium">
            <Eye className="w-3 h-3" />
            {photo.view_count}
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
              <Camera className="w-6 h-6 text-gray-900" />
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2 leading-snug mb-2 group-hover:text-[#0078C0] transition-colors">
            {photo.title}
          </h3>
          {photo.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">
              {photo.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
            <span>
              {new Date(
                photo.published_at || photo.created_at
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {photo.like_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages: number[] = [];
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-12">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            1
          </button>
          {startPage > 2 && <span className="text-gray-400">...</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
            page === currentPage
              ? "bg-[#0078C0] text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="text-gray-400">...</span>
          )}
          <button
            onClick={() => onPageChange(totalPages)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<PhotoFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState<"all" | "featured">(
    "all"
  );

  const limit = 12;

  useEffect(() => {
    fetchPhotos();
  }, [currentPage, featuredFilter]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const params: Parameters<typeof photoFeaturesApi.list>[0] = {
        page: currentPage,
        limit,
        status: "published",
      };
      if (featuredFilter === "featured") {
        params.is_featured = true;
      }
      const response = await photoFeaturesApi.list(params);
      setPhotos(response.data);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load photos:", err);
      setPhotos([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const handleFeaturedChange = (filter: "all" | "featured") => {
    setFeaturedFilter(filter);
    setCurrentPage(1);
  };

  const filteredPhotos = searchQuery
    ? photos.filter(
        (photo) =>
          photo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          photo.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : photos;

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Photos" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Photo Features
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Explore stunning photo collections showcasing Nepal&apos;s
            breathtaking landscapes, vibrant culture, and unforgettable moments.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Featured Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Camera className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Show:</span>
              <div className="flex gap-2">
                {[
                  { value: "all" as const, label: "All Photos" },
                  { value: "featured" as const, label: "⭐ Featured" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFeaturedChange(option.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      featuredFilter === option.value
                        ? "bg-[#0078C0] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full hover:border-[#0078C0] transition-colors bg-white flex-1 md:flex-initial">
                <Search className="w-4 h-4 text-[#0078C0]" />
                <input
                  type="text"
                  placeholder="Search photo features..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="outline-none bg-transparent text-sm w-full md:w-64 placeholder:text-gray-400"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
              >
                Search
              </button>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {filteredPhotos.length} of {total} photo features
              {featuredFilter === "featured" && " (featured only)"}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </div>

        {/* Photos Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <PhotoCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📷</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Photo Features Found
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? `No photo features match your search "${searchQuery}"`
                : featuredFilter === "featured"
                  ? "No featured photo collections at the moment"
                  : "No photo collections available at the moment"}
            </p>
            {(searchQuery || featuredFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchInput("");
                  setFeaturedFilter("all");
                  setCurrentPage(1);
                }}
                className="mt-4 px-6 py-2 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Featured highlight row */}
            {featuredFilter === "all" &&
              currentPage === 1 &&
              !searchQuery &&
              filteredPhotos.some((p) => p.is_featured) && (
                <div className="mb-8">
                  <h2 className="font-display text-lg font-bold text-[#1A2B49] mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    Featured Collections
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredPhotos
                      .filter((p) => p.is_featured)
                      .slice(0, 2)
                      .map((photo) => (
                        <PhotoCard key={`featured-${photo.id}`} photo={photo} />
                      ))}
                  </div>
                </div>
              )}

            {/* All photos grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPhotos
                .filter((p) =>
                  featuredFilter === "all" && currentPage === 1 && !searchQuery
                    ? !p.is_featured
                    : true
                )
                .map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} />
                ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
