import { SectionHeading } from "@/components/atoms/section-heading";
import { ArticleCard } from "@/components/atoms/article-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { ArticlesSkeleton } from "@/components/ui/Skeleton";
import { postsApi } from "@/lib/api-client";

export async function ArticlesSection() {
  let articles;
  try {
    const res = await postsApi.list({ limit: 4, status: "published" });
    articles = res.data;
  } catch {
    // Show skeleton on error
    return <ArticlesSkeleton />;
  }

  // Show skeleton when no articles
  if (!articles || articles.length === 0) {
    return <ArticlesSkeleton />;
  }

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="ARTICLES" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              image={article.cover_image || ""}
              title={article.title}
              description={article.short_description || ""}
              href={`/blogs/${article.slug}`}
            />
          ))}
        </div>

        <ViewMoreButton href="/articles" />
      </div>
    </section>
  );
}
