import type { Metadata } from "next";
import { activitiesApi } from "@/lib/api-client";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { LikeButton } from "@/components/ui/LikeButton";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { prepareContent } from "@/lib/sanitize";
import {
  generateActivityJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const activity = await activitiesApi.getBySlug(slug);

    return {
      title: `${activity.title} — Activities in Nepal`,
      description:
        activity.short_description ||
        `Experience ${activity.title}, an exciting activity in Nepal`,
      openGraph: {
        title: activity.title,
        description:
          activity.short_description || `Experience ${activity.title} in Nepal`,
        url: `${BASE_URL}/activities/${slug}`,
        type: "article",
        images: activity.cover_image ? [activity.cover_image] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: activity.title,
        description:
          activity.short_description || `Experience ${activity.title} in Nepal`,
        images: activity.cover_image ? [activity.cover_image] : [],
      },
      alternates: {
        canonical: `${BASE_URL}/activities/${slug}`,
      },
    };
  } catch {
    return {
      title: "Activity Not Found",
    };
  }
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let activity;
  try {
    activity = await activitiesApi.getBySlug(slug);
  } catch {
    notFound();
  }

  if (!activity) {
    notFound();
  }

  const activityJsonLd = generateActivityJsonLd({
    title: activity.title,
    description: activity.short_description || undefined,
    slug: activity.slug,
    coverImage: activity.cover_image,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Activities", href: "/activities" },
    { name: activity.title },
  ]);

  return (
    <div className="bg-white">
      <script {...jsonLdScriptProps(activityJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      {/* Invisible view tracker — fires once on mount */}
      <ViewTracker targetType="post" targetId={activity.id} />

      {/* Hero Section */}
      {activity.cover_image && (
        <section className="relative h-[400px] w-full">
          <img
            src={activity.cover_image}
            alt={activity.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 max-w-[1400px] mx-auto">
            <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-4 uppercase tracking-wide">
              {activity.title}
            </h1>
            {activity.short_description && (
              <p className="text-white/90 text-base max-w-2xl leading-relaxed">
                {activity.short_description}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Engagement Bar */}
      <section className="border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Eye className="w-4 h-4" />
                <span>{activity.views.toLocaleString()} views</span>
              </div>
              <LikeButton
                targetType="post"
                targetId={activity.id}
                initialCount={activity.likes}
                size="sm"
              />
            </div>
            <ShareButtons
              title={activity.title}
              description={activity.short_description || undefined}
              compact
            />
          </div>
        </div>
      </section>

      {/* Content Section */}
      {!!activity.content && (
        <section className="py-12 px-6">
          <div className="max-w-[1400px] mx-auto">
            <div className="lg:max-w-3xl">
              <h2 className="font-display text-3xl font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
                OVERVIEW
              </h2>
              <div
                className="prose prose-lg max-w-none text-[#4B5563] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: prepareContent(activity.content),
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Fallback if no content and no hero */}
      {!activity.content && !activity.cover_image && (
        <section className="py-12 px-6">
          <div className="max-w-[1400px] mx-auto">
            <h1 className="font-display text-5xl font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
              {activity.title}
            </h1>
            {activity.short_description && (
              <p className="text-lg text-[#4B5563] leading-relaxed">
                {activity.short_description}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Share Section */}
      <section className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-md">
            <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
              Share this activity
            </h3>
            <ShareButtons
              title={activity.title}
              description={activity.short_description || undefined}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
