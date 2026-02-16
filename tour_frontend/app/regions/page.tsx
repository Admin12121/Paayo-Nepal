"use client";

import { useState, useEffect } from "react";
import { MapPin, Filter } from "lucide-react";
import { regionsApi, Region } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";

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

// Region Card Component
function RegionCard({ region }: { region: Region }) {
  return (
    <Link href={`/regions/${region.slug}`}>
      <div
        className="relative overflow-hidden cursor-pointer group rounded-[20px] h-[420px]"
        style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
      >
        {region.cover_image ? (
          <Image
            src={region.cover_image}
            alt={region.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <MapPin className="w-16 h-16 text-gray-400" />
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, rgba(242, 156, 114, 0.95) 100%)",
          }}
        />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            {region.province && (
              <span className="text-xs font-semibold text-white bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                {region.province}
              </span>
            )}
            {region.district && (
              <span className="text-xs text-white/90">{region.district}</span>
            )}
          </div>
          <h3 className="font-display text-3xl font-semibold text-white leading-tight mb-2">
            {region.name}
          </h3>
          {region.description && (
            <p className="text-white/90 text-sm leading-relaxed line-clamp-2">
              {region.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// Region Card Skeleton
function RegionCardSkeleton() {
  return (
    <div
      className="rounded-[20px] h-[420px] bg-gray-200 animate-pulse"
      style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
    ></div>
  );
}

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 12;

  // Get unique provinces from regions
  const provinces = Array.from(
    new Set(regions.map((r) => r.province).filter(Boolean)),
  ).sort() as string[];

  useEffect(() => {
    fetchRegions();
  }, [currentPage, selectedProvince]);

  const fetchRegions = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: currentPage,
        limit,
      };

      if (selectedProvince !== "all") {
        params.province = selectedProvince;
      }

      const response = await regionsApi.list(params);
      setRegions(response.data);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err: any) {
      console.error("Failed to load regions:", err);
      setRegions([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setCurrentPage(1);
  };

  // Get all unique provinces for the filter
  const allProvinces = [
    "Province 1",
    "Madhesh Province",
    "Bagmati Province",
    "Gandaki Province",
    "Lumbini Province",
    "Karnali Province",
    "Sudurpashchim Province",
  ];

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Regions" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Explore Regions of Nepal
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Discover the diverse landscapes, cultures, and attractions across
            Nepal's beautiful regions and provinces.
          </p>
        </div>

        {/* Province Filter */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Filter by province:
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleProvinceChange("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedProvince === "all"
                    ? "bg-[#0078C0] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All Provinces
              </button>
              {allProvinces.map((province) => (
                <button
                  key={province}
                  onClick={() => handleProvinceChange(province)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedProvince === province
                      ? "bg-[#0078C0] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {province}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {regions.length} of {total} regions
              {selectedProvince !== "all" && ` in ${selectedProvince}`}
            </p>
          </div>
        </div>

        {/* Regions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <RegionCardSkeleton key={i} />
            ))}
          </div>
        ) : regions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Regions Found
            </h3>
            <p className="text-gray-600">
              {selectedProvince !== "all"
                ? `No regions available in ${selectedProvince} at the moment`
                : "No regions available at the moment"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regions.map((region) => (
                <RegionCard key={region.id} region={region} />
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
