"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { postsApi, Post } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";
import { useViewTracker } from "@/lib/hooks/use-view-tracker";
import { LikeButton } from "@/components/ui/LikeButton";
import { CommentSection } from "@/components/ui/CommentSection";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { prepareContent } from "@/lib/sanitize";

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

// Related Article Card for Sidebar
function RelatedArticleCard({ article }: { article: Post }) {
  return (
    <Link href={`/blogs/${article.slug}`}>
      <div className="group cursor-pointer">
        <div className="rounded-[10px] overflow-hidden aspect-video mb-2 relative">
          {article.cover_image ? (
            <Image
              src={article.cover_image}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
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
            {article.views || 0}
          </span>
        </div>
        <h4 className="font-display text-sm font-semibold text-[#F29C72] leading-snug uppercase tracking-wide line-clamp-2">
          {article.title}
        </h4>
      </div>
    </Link>
  );
}

export default function BlogDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [post, setPost] = useState<Post | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the page view once the post is loaded
  useViewTracker("post", post?.id);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load article");
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
                <ShareButtons
                  title={post.title}
                  description={post.short_description || undefined}
                  compact
                />
              </div>
            </div>

            {/* Featured Image */}
            {post.cover_image && (
              <div className="rounded-[12px] overflow-hidden mb-4 relative h-[500px]">
                <Image
                  src={post.cover_image}
                  alt={post.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Excerpt */}
            {post.short_description && (
              <>
                <p className="text-[#F29C72] italic text-sm mb-4 text-center">
                  {post.short_description}
                </p>
                <div className="h-px bg-gray-300 mb-6"></div>
              </>
            )}

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <div
                className="text-[#4B5563] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: prepareContent(post.content),
                }}
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
            <div className="flex items-center justify-between flex-wrap gap-4 mt-8 py-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[#868383] text-sm">
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">
                    {post.views.toLocaleString()} views
                  </span>
                </div>
                <LikeButton
                  targetType="post"
                  targetId={post.id}
                  initialCount={post.likes}
                  size="sm"
                />
              </div>
              <ShareButtons
                title={post.title}
                description={post.short_description || undefined}
                compact
              />
            </div>

            {/* Comments Section */}
            <div className="mt-6">
              <CommentSection targetType="post" targetId={post.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Share card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                Share this article
              </h3>
              <ShareButtons
                title={post.title}
                description={post.short_description || undefined}
              />
            </div>

            {/* Related Articles */}
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
