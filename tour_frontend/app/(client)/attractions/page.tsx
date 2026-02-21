"use client";

import { useState, useEffect } from "react";
import { MapPin, Star, Clock, IndianRupee } from "lucide-react";
import {
  attractionsApi,
  Attraction,
  regionsApi,
  Region,
} from "@/lib/api-client";
import Image from "next/image";
import Link from "@/components/ui/animated-link";

// Breadcrumbs Component
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

// Rating Display Component
function RatingDisplay({
  rating,
  reviewCount,
}: {
  rating: number | null;
  reviewCount: number;
}) {
  if (!rating) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < Math.floor(rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-gray-600">
        {rating.toFixed(1)} ({reviewCount} reviews)
      </span>
    </div>
  );
}

// Attraction Card Component
function AttractionCard({ attraction }: { attraction: Attraction }) {
  return (
    <Link href={`/attractions/${attraction.slug}`}>
      <div
        className="bg-white rounded-[20px] overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl"
        style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
      >
        <div className="overflow-hidden rounded-[16px] h-[280px] relative">
          {attraction.cover_image ? (
            <Image
              src={attraction.cover_image}
              alt={attraction.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <MapPin className="w-16 h-16 text-gray-400" />
            </div>
          )}
          {attraction.is_featured && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-[#F29C72] text-white text-xs font-semibold rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-white" />
              Top Attraction
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-display text-xl font-semibold text-[#1A2B49] mb-2 line-clamp-2">
            {attraction.title}
          </h3>

          {attraction.short_description && (
            <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-2">
              {attraction.short_description}
            </p>
          )}

          <div className="space-y-2">
            <RatingDisplay
              rating={attraction.rating}
              reviewCount={attraction.review_count}
            />

            {attraction.address && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-[#0078C0] shrink-0" />
                <span className="line-clamp-1">{attraction.address}</span>
              </div>
            )}

            {attraction.entry_fee && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <IndianRupee className="w-4 h-4 text-[#0078C0] shrink-0" />
                <span>{attraction.entry_fee}</span>
              </div>
            )}

            {attraction.opening_hours && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-[#0078C0] shrink-0" />
                <span>
                  {(() => {
                    const mon = attraction.opening_hours?.monday;
                    if (mon && typeof mon === "object" && "open" in mon) {
                      return `${mon.open}${mon.close ? ` - ${mon.close}` : ""}`;
                    }
                    return typeof mon === "string" ? mon : "Check timings";
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Attraction Card Skeleton
function AttractionCardSkeleton() {
  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden animate-pulse"
      style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
    >
      <div className="h-[280px] bg-gray-200"></div>
      <div className="p-5">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  );
}

export default function AttractionsPage() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [topAttractions, setTopAttractions] = useState<Attraction[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 12;

  useEffect(() => {
    fetchRegions();
    fetchTopAttractions();
  }, []);

  useEffect(() => {
    fetchAttractions();
  }, [currentPage, selectedRegion]);

  const fetchRegions = async () => {
    try {
      const response = await regionsApi.list({ limit: 100 });
      setRegions(response.data);
    } catch (err) {
      console.error("Failed to fetch regions:", err);
    }
  };

  const fetchTopAttractions = async () => {
    try {
      const response = await attractionsApi.top({ limit: 6 });
      setTopAttractions(response.data);
    } catch (err) {
      console.error("Failed to fetch top attractions:", err);
    }
  };

  const fetchAttractions = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: currentPage,
        limit,
      };

      if (selectedRegion !== "all") {
        params.region_id = selectedRegion;
      }

      const response = await attractionsApi.list(params);
      setAttractions(response.data);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      console.error("Failed to load attractions:", err);
      setAttractions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId);
    setCurrentPage(1);
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Attractions" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Attractions in Nepal
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Explore Nepal's most captivating destinations, from ancient temples
            and historic sites to natural wonders and cultural landmarks.
          </p>
        </div>

        {/* Top Attractions */}
        {topAttractions.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-6 h-6 text-[#F29C72] fill-[#F29C72]" />
              <h2 className="font-display text-2xl font-bold text-[#1A2B49]">
                Top Attractions
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topAttractions.map((attraction) => (
                <AttractionCard key={attraction.id} attraction={attraction} />
              ))}
            </div>
          </div>
        )}

        {/* Region Filter */}
        <div className="mb-8 p-4 sm:p-5">
          <div className="flex w-full flex-row flex-wrap items-end justify-between gap-3">
            <span className="text-sm font-medium text-gray-700">
              Filter by region
            </span>
            <select
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Regions</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* All Attractions Section */}
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-6">
            {selectedRegion === "all"
              ? "All Attractions"
              : `Attractions in ${regions.find((r) => r.id === selectedRegion)?.name}`}
          </h2>
        </div>

        {/* Attractions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <AttractionCardSkeleton key={i} />
            ))}
          </div>
        ) : attractions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏛️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Attractions Found
            </h3>
            <p className="text-gray-600">
              {selectedRegion !== "all"
                ? "No attractions available in this region at the moment"
                : "No attractions available at the moment"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attractions.map((attraction) => (
                <AttractionCard key={attraction.id} attraction={attraction} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                        page === currentPage
                          ? "bg-[#0078C0] text-white"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
