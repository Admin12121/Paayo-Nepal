import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { RegionsSkeleton } from "@/components/ui/Skeleton";
import { regionsApi } from "@/lib/api-client";

export async function RegionsSection() {
  let regions;
  try {
    const res = await regionsApi.list({ limit: 9 });
    regions = res.data;
  } catch {
    return <RegionsSkeleton />;
  }

  if (!regions || regions.length === 0) return <RegionsSkeleton />;

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="EXPLORE BY REGIONS" />

        {/* 3x3 Grid - up to 9 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {regions.slice(0, 9).map((region) => (
            <ImageCard
              key={region.id}
              src={region.cover_image || ""}
              alt={region.name}
              title={region.name}
              href={`/regions/${region.slug}`}
              variant="white-bottom"
            />
          ))}
        </div>

        <ViewMoreButton href="/regions" />
      </div>
    </section>
  );
}
