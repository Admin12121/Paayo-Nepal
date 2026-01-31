"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import {
  Eye,
  ThumbsUp,
  MessageCircle,
  User,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { postsApi, Post, commentsApi, Comment } from "@/lib/api-client";
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

// Social Share Icons
function SocialShareIcons() {
  return (
    <div className="flex items-center gap-2">
      {/* WhatsApp */}
      <a
        href="#"
        className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center hover:opacity-80 transition-opacity"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
      {/* Facebook */}
      <a
        href="#"
        className="w-7 h-7 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-80 transition-opacity"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
      {/* X (Twitter) */}
      <a
        href="#"
        className="w-7 h-7 rounded-full bg-black flex items-center justify-center hover:opacity-80 transition-opacity"
      >
        <svg
          className="w-3.5 h-3.5 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
    </div>
  );
}

// Related Article Card for Sidebar
function RelatedArticleCard({ article }: { article: Post }) {
  return (
    <Link href={`/blogs/${article.slug}`}>
      <div className="group cursor-pointer">
        <div className="rounded-[10px] overflow-hidden aspect-video mb-2 relative">
          {article.featured_image ? (
            <Image
              src={article.featured_image}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              placeholder={article.featured_image_blur ? "blur" : "empty"}
              blurDataURL={article.featured_image_blur || undefined}
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
          <span>
            {new Date(
              article.published_at || article.created_at,
            ).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {article.views}
          </span>
        </div>
        <h4 className="font-display text-sm font-semibold text-[#F29C72] leading-snug uppercase tracking-wide line-clamp-2">
          {article.title}
        </h4>
      </div>
    </Link>
  );
}

// Comment Component (placeholder - actual API integration would go here)
function CommentSection({ postId }: { postId: string }) {
  return (
    <div className="bg-white rounded-[16px] p-6 mt-6">
      <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-6">
        Comments
      </h3>

      {/* Comment Input */}
      <div className="flex gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
          <div className="w-full h-full bg-gray-300 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-500" />
          </div>
        </div>
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Write a comment..."
            className="w-full h-11 px-4 pr-12 rounded-full border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0078C0] focus:border-transparent"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0078C0] transition-colors">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Placeholder message */}
      <div className="text-center py-8 text-gray-500">
        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Comments feature coming soon</p>
      </div>
    </div>
  );
}

export default function BlogDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [post, setPost] = useState<Post | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchPost();
      fetchRelatedArticles();
    }
  }, [slug]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await postsApi.getBySlug(slug);
      setPost(data);
    } catch (err: any) {
      setError(err.message || "Failed to load article");
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedArticles = async () => {
    try {
      const response = await postsApi.list({ limit: 5, status: "published" });
      setRelatedArticles(response.data.filter((p) => p.slug !== slug));
    } catch (err) {
      console.error("Failed to fetch related articles:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen pt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-[400px] bg-gray-200 rounded-2xl mb-6"></div>
            <div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    notFound();
  }

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Articles", href: "/articles" },
            { label: post.title },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Blog Header */}
            <div className="mb-6">
              <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#1A2B49] mb-3 leading-tight">
                {post.title}
              </h1>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-[#868383]">
                  <span>
                    {new Date(
                      post.published_at || post.created_at,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span>|</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold uppercase">
                    {post.post_type}
                  </span>
                </div>
                <SocialShareIcons />
              </div>
            </div>

            {/* Featured Image */}
            {post.featured_image && (
              <div className="rounded-[12px] overflow-hidden mb-4 relative h-[500px]">
                <Image
                  src={post.featured_image}
                  alt={post.title}
                  fill
                  className="object-cover"
                  priority
                  placeholder={post.featured_image_blur ? "blur" : "empty"}
                  blurDataURL={post.featured_image_blur || undefined}
                />
              </div>
            )}

            {/* Excerpt */}
            {post.excerpt && (
              <>
                <p className="text-[#F29C72] italic text-sm mb-4 text-center">
                  {post.excerpt}
                </p>
                <div className="h-px bg-gray-300 mb-6"></div>
              </>
            )}

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <div
                className="text-[#4B5563] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-8 pt-6 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Tags:</span>
                {post.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Engagement Stats */}
            <div className="flex items-center justify-end gap-6 mt-8 py-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-[#868383]">
                <Eye className="w-5 h-5" />
                <span className="font-medium">
                  {post.views.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#868383]">
                <ThumbsUp className="w-5 h-5" />
                <span className="font-medium">{post.likes}</span>
              </div>
            </div>

            {/* Comments Section */}
            <CommentSection postId={post.id} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
              MORE ARTICLES
            </h3>
            <div className="space-y-6">
              {relatedArticles.slice(0, 5).map((article) => (
                <RelatedArticleCard key={article.id} article={article} />
              ))}
            </div>
            {relatedArticles.length > 5 && (
              <Link
                href="/articles"
                className="block mt-6 text-center text-[#0078C0] font-semibold hover:text-[#0068A0] transition-colors"
              >
                View All Articles →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
