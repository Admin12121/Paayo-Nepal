import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { regionsApi } from "@/lib/api-client";

export async function RegionsSection() {
  let regions;
  try {
    const res = await regionsApi.list({ limit: 8 });
    regions = res.data;
  } catch {
    return null;
  }

  if (!regions || regions.length === 0) return null;

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="EXPLORE BY REGIONS" />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {regions.slice(0, 8).map((region) => (
            <ImageCard
              key={region.id}
              src={region.cover_image || ""}
              alt={region.name}
              title={region.name}
              href={`/regions/${region.slug}`}
              variant="bottom"
            />
          ))}
        </div>

        <ViewMoreButton href="/regions" />
      </div>
    </section>
  );
}
