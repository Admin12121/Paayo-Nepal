"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Star, Eye, DollarSign } from "lucide-react";
import { hotelsApi, Hotel } from "@/lib/api-client";
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

function HotelCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-5">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  const getPriceLabel = (range: string | null) => {
    switch (range) {
      case "budget":
        return { label: "Budget", symbol: "$", color: "text-green-600 bg-green-50" };
      case "mid":
        return { label: "Mid-range", symbol: "$$", color: "text-blue-600 bg-blue-50" };
      case "luxury":
        return { label: "Luxury", symbol: "$$$", color: "text-purple-600 bg-purple-50" };
      default:
        return { label: "N/A", symbol: "—", color: "text-gray-600 bg-gray-50" };
    }
  };

  const price = getPriceLabel(hotel.price_range);

  return (
    <Link href={`/hotels/${hotel.slug}`}>
      <div className="bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 group h-full flex flex-col">
        <div className="relative aspect-[4/3] bg-gray-200 overflow-hidden">
          {hotel.cover_image ? (
            <img
              src={hotel.cover_image}
              alt={hotel.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <MapPin className="w-12 h-12 text-gray-300" />
            </div>
          )}

          {/* Price range badge */}
          <div
            className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${price.color}`}
          >
            {price.symbol} {price.label}
          </div>

          {/* Featured badge */}
          {hotel.is_featured && (
            <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
          )}

          {/* View count */}
          <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-medium">
            <Eye className="w-3 h-3" />
            {hotel.view_count}
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-[#0078C0] transition-colors">
            {hotel.name}
          </h3>

          {/* Star rating */}
          {hotel.star_rating && (
            <div className="flex items-center gap-1 mb-2">
              {Array.from({ length: hotel.star_rating }).map((_, i) => (
                <Star
                  key={i}
                  className="w-4 h-4 text-yellow-400 fill-yellow-400"
                />
              ))}
              {Array.from({ length: 5 - hotel.star_rating }).map((_, i) => (
                <Star key={`empty-${i}`} className="w-4 h-4 text-gray-200" />
              ))}
              <span className="text-xs text-gray-500 ml-1">
                {hotel.star_rating}-star
              </span>
            </div>
          )}

          {hotel.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">
              {hotel.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
            <span>
              {new Date(
                hotel.published_at || hotel.created_at
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {hotel.email && (
              <span className="truncate max-w-[140px]">{hotel.email}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PaginationControl({
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

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");

  const limit = 12;

  useEffect(() => {
    fetchHotels();
  }, [currentPage, priceFilter]);

  const fetchHotels = async () => {
    try {
      setLoading(true);
      const params: Parameters<typeof hotelsApi.list>[0] = {
        page: currentPage,
        limit,
        status: "published",
      };
      if (priceFilter !== "all") {
        params.price_range = priceFilter;
      }
      const response = await hotelsApi.list(params);
      setHotels(response.data);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load hotels:", err);
      setHotels([]);
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

  const handlePriceChange = (price: string) => {
    setPriceFilter(price);
    setCurrentPage(1);
  };

  const filteredHotels = searchQuery
    ? hotels.filter(
        (hotel) =>
          hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          hotel.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : hotels;

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Hotels" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Hotels & Stays
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Find the perfect accommodation for your Nepal adventure — from
            budget-friendly guesthouses to luxury resorts.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Price Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Price range:
              </span>
              <div className="flex gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "budget", label: "Budget ($)" },
                  { value: "mid", label: "Mid ($$)" },
                  { value: "luxury", label: "Luxury ($$$)" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePriceChange(option.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      priceFilter === option.value
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
                  placeholder="Search hotels..."
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
              Showing {filteredHotels.length} of {total} hotels
              {priceFilter !== "all" && ` in ${priceFilter} range`}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </div>

        {/* Hotels Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <HotelCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏨</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Hotels Found
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? `No hotels match your search "${searchQuery}"`
                : "No hotels available at the moment"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHotels.map((hotel) => (
                <HotelCard key={hotel.id} hotel={hotel} />
              ))}
            </div>

            {totalPages > 1 && (
              <PaginationControl
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
