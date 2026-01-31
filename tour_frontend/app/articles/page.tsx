"use client";

import { useState, useEffect } from "react";
import { Search, Filter } from "lucide-react";
import { postsApi, Post } from "@/lib/api-client";
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

// Article Card Skeleton
function ArticleCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 p-6 animate-pulse">
      <div className="flex gap-6">
        <div className="w-64 h-64 bg-gray-200 rounded-2xl flex-shrink-0"></div>
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
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

// Article Card Component
function ArticleCard({ article }: { article: Post }) {
  return (
    <Link href={`/blogs/${article.slug}`}>
      <div className="bg-white rounded-3xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 p-6">
        <div className="flex gap-6">
          <div className="overflow-hidden rounded-2xl w-64 h-64 flex-shrink-0 relative">
            {article.featured_image ? (
              <Image
                src={article.featured_image}
                alt={article.title}
                fill
                className="object-cover hover:scale-105 transition-transform duration-300"
                placeholder={article.featured_image_blur ? "blur" : "empty"}
                blurDataURL={article.featured_image_blur || undefined}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">No image</span>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-between py-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-[#0078C0] uppercase tracking-wide px-3 py-1 bg-blue-50 rounded-full">
                  {article.post_type}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(
                    article.published_at || article.created_at,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 line-clamp-2">
                {article.title}
              </h3>
              <p className="text-base text-gray-500 leading-relaxed line-clamp-3">
                {article.excerpt || "No excerpt available"}
              </p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  {article.views}
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  {article.likes}
                </span>
              </div>
              <button className="text-blue-600 text-sm font-bold hover:text-blue-700 flex items-center gap-2 uppercase tracking-wide">
                READ MORE
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
      </div>
    </Link>
  );
}

// Pagination Component
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = [];
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

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

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const limit = 10;

  useEffect(() => {
    fetchArticles();
  }, [currentPage, selectedType]);

  const fetchArticles = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: currentPage,
        limit,
        status: "published",
      };

      if (selectedType !== "all") {
        params.type = selectedType;
      }

      const response = await postsApi.list(params);
      setArticles(response.data);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err: any) {
      console.error("Failed to load articles:", err);
      setArticles([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1);
    fetchArticles();
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setCurrentPage(1);
  };

  const filteredArticles = searchQuery
    ? articles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : articles;

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Articles" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Articles & Blog
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Discover stories, insights, and news about Nepal's amazing
            destinations, culture, and travel experiences.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Type Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Filter by:
              </span>
              <div className="flex gap-2">
                {["all", "blog", "article", "news"].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedType === type
                        ? "bg-[#0078C0] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
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
                  placeholder="Search articles..."
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
              Showing {filteredArticles.length} of {total} articles
              {selectedType !== "all" && ` in ${selectedType}`}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </div>

        {/* Articles Grid */}
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Articles Found
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? `No articles match your search "${searchQuery}"`
                : "No articles available at the moment"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
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
