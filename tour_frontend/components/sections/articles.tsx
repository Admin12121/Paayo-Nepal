import { SectionHeading } from "@/components/atoms/section-heading";
import { ArticleCard } from "@/components/atoms/article-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { postsApi } from "@/lib/api-client";
import { getPostPublicPath } from "@/lib/post-routes";

export async function ArticlesSection() {
  let articles: Awaited<ReturnType<typeof postsApi.list>>["data"] = [];
  try {
    const res = await postsApi.list({
      limit: 4,
      status: "published",
      type: "article",
    });
    articles = res.data.filter((item) => item.post_type === "article");
  } catch {
    articles = [];
  }

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="ARTICLES" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {!articles || articles.length === 0 ? (
            <h1>NO content available</h1>
          ) : (
            articles.map((article) => (
              <ArticleCard
                key={article.id}
                image={article.cover_image || ""}
                title={article.title}
                description={article.short_description || ""}
                date={new Date(
                  article.published_at || article.created_at,
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                views={article.views ?? article.view_count ?? 0}
                href={getPostPublicPath(article)}
              />
            ))
          )}
        </div>

        <ViewMoreButton href="/articles" />
      </div>
    </section>
  );
}
