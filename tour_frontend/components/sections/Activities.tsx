import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { ActivitiesSkeleton } from "@/components/ui/Skeleton";
import { activitiesApi } from "@/lib/api-client";

export async function ActivitiesSection() {
  let activities;
  try {
    const res = await activitiesApi.list({ limit: 6 });
    activities = res.data;
  } catch {
    return <ActivitiesSkeleton />;
  }

  if (!activities || activities.length === 0) return <ActivitiesSkeleton />;

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="ACTIVITIES" />

        {/* 2x3 Grid with tall portrait cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {activities.slice(0, 6).map((activity) => (
            <ImageCard
              key={activity.id}
              src={activity.cover_image || ""}
              alt={activity.title}
              title={activity.title}
              href={`/activities/${activity.slug}`}
              className="h-[350px]"
            />
          ))}
        </div>

        <ViewMoreButton href="/activities" />
      </div>
    </section>
  );
}
