import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { AttractionsSkeleton } from "@/components/ui/Skeleton";
import { attractionsApi } from "@/lib/api-client";

export async function AttractionsSection() {
  let attractions;
  try {
    const res = await attractionsApi.top({ limit: 5 });
    attractions = res.data;
  } catch {
    return <AttractionsSkeleton />;
  }

  if (!attractions || attractions.length === 0) return <AttractionsSkeleton />;

  const featured = attractions[0];
  const sideItems = attractions.slice(1, 5);

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="TOP ATTRACTIONS" />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {featured ? (
            <ImageCard
              key={featured.id}
              src={featured.cover_image || ""}
              alt={featured.title}
              title={featured.title}
              href={`/attractions/${featured.slug}`}
              className="h-[320px] lg:col-span-2 lg:h-[420px]"
            />
          ) : null}
          <div className="grid grid-cols-2 gap-5">
            {sideItems.map((attraction) => (
              <ImageCard
                key={attraction.id}
                src={attraction.cover_image || ""}
                alt={attraction.title}
                title={attraction.title}
                href={`/attractions/${attraction.slug}`}
                className="h-[150px] lg:h-[200px]"
              />
            ))}
          </div>
        </div>

        <ViewMoreButton href="/attractions" />
      </div>
    </section>
  );
}
