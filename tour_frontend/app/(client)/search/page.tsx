"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { searchApi, SearchResult } from "@/lib/api-client";
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

// Result Card Component
function ResultCard({ result }: { result: SearchResult }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "post":
        return "bg-blue-100 text-blue-700";
      case "event":
        return "bg-purple-100 text-purple-700";
      case "attraction":
        return "bg-green-100 text-green-700";
      case "region":
        return "bg-orange-100 text-orange-700";
      case "activity":
        return "bg-pink-100 text-pink-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Link href={result.url}>
      <div className="bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 p-6">
        <div className="flex gap-6">
          {result.cover_image && (
            <div className="overflow-hidden rounded-xl w-48 h-48 flex-shrink-0 relative">
              <Image
                src={result.cover_image}
                alt={result.title}
                fill
                className="object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="flex-1 flex flex-col justify-between py-2">
            <div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase mb-3 ${getTypeColor(result.result_type)}`}
              >
                {result.result_type}
              </span>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
                {result.title}
              </h3>
              {result.excerpt && (
                <p className="text-base text-gray-500 leading-relaxed line-clamp-3">
                  {result.excerpt}
                </p>
              )}
            </div>
            <button className="text-blue-600 text-sm font-bold hover:text-blue-700 self-end flex items-center gap-2 uppercase tracking-wide mt-4">
              VIEW DETAILS
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Result Card Skeleton
function ResultCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 p-6 animate-pulse">
      <div className="flex gap-6">
        <div className="w-48 h-48 bg-gray-200 rounded-xl flex-shrink-0"></div>
        <div className="flex-1 flex flex-col justify-between py-2">
          <div>
            <div className="h-6 bg-gray-200 rounded w-20 mb-3"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-32 self-end mt-4"></div>
        </div>
      </div>
    </div>
  );
}

// Search Page Loading Skeleton
function SearchPageSkeleton() {
  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="h-4 bg-gray-200 rounded w-32 mb-6 animate-pulse"></div>
        <div className="h-12 bg-gray-200 rounded w-64 mb-10 animate-pulse"></div>
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm animate-pulse">
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded w-3/4"></div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <ResultCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// The actual search content component that uses useSearchParams
function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedType, setSelectedType] = useState<string>("all");

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (query: string, type?: string) => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = { limit: 50 };
      if (type && type !== "all") {
        params.type = type;
      }

      const response = await searchApi.search(query, params);
      setResults(response.results);
      setTotal(response.total);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to perform search";
      setError(errorMessage);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    performSearch(searchInput, selectedType);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (searchQuery) {
      performSearch(searchQuery, type);
    }
  };

  // Results are already filtered by type from the API, no need to re-filter
  const filteredResults = results;

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Search" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Search Results
          </h1>
          {searchQuery && (
            <p className="text-lg text-gray-600">
              {total > 0
                ? `Found ${total} results for "${searchQuery}"`
                : `No results found for "${searchQuery}"`}
            </p>
          )}
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex gap-4 items-center mb-4">
            <div className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-full hover:border-[#0078C0] transition-colors bg-white flex-1">
              <Search className="w-5 h-5 text-[#0078C0]" />
              <input
                type="text"
                placeholder="Search for articles, events, attractions, regions..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="outline-none bg-transparent text-base w-full placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-8 py-3 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
            >
              Search
            </button>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-gray-200">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Filter by type:
            </span>
            <div className="flex gap-2">
              {["all", "post", "event", "attraction", "region", "activity"].map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedType === type
                        ? "bg-[#0078C0] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {type === "all"
                      ? "All"
                      : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {!searchQuery ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Start Your Search
            </h3>
            <p className="text-gray-600">
              Enter keywords to search across articles, events, attractions,
              regions, and activities
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <ResultCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Search Error
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => performSearch(searchQuery, selectedType)}
              className="px-6 py-3 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Results Found
            </h3>
            <p className="text-gray-600 mb-6">
              We couldn&apos;t find any results matching &quot;{searchQuery}&quot;
              {selectedType !== "all" && ` in ${selectedType}`}
            </p>
            <div className="text-sm text-gray-600">
              <p className="mb-2">Try:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Using different keywords</li>
                <li>Checking your spelling</li>
                <li>Using more general terms</li>
                <li>Removing filters</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Showing {filteredResults.length} of {total} results
                {selectedType !== "all" && ` (filtered by ${selectedType})`}
              </p>
            </div>
            <div className="space-y-6">
              {filteredResults.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Main export with Suspense wrapper
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}
