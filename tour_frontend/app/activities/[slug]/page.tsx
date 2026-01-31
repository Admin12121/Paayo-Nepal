import { activitiesApi } from "@/lib/api-client";
import { notFound } from "next/navigation";

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

  return (
    <div className="bg-white">
      {/* Hero Section */}
      {(activity.hero_image || activity.featured_image) && (
        <section className="relative h-[400px] w-full">
          <img
            src={activity.hero_image || activity.featured_image || ""}
            alt={activity.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 max-w-[1400px] mx-auto">
            <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-4 uppercase tracking-wide">
              {activity.name}
            </h1>
            {activity.description && (
              <p className="text-white/90 text-base max-w-2xl leading-relaxed">
                {activity.description}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Content Section */}
      {activity.content && (
        <section className="py-12 px-6">
          <div className="max-w-[1400px] mx-auto">
            <div className="lg:max-w-3xl">
              <h2 className="font-display text-3xl font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
                OVERVIEW
              </h2>
              <div
                className="prose prose-lg max-w-none text-[#4B5563] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: activity.content }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Fallback if no content and no hero */}
      {!activity.content &&
        !activity.hero_image &&
        !activity.featured_image && (
          <section className="py-12 px-6">
            <div className="max-w-[1400px] mx-auto">
              <h1 className="font-display text-5xl font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
                {activity.name}
              </h1>
              {activity.description && (
                <p className="text-lg text-[#4B5563] leading-relaxed">
                  {activity.description}
                </p>
              )}
            </div>
          </section>
        )}
    </div>
  );
}
