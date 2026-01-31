import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { attractionsApi } from "@/lib/api-client";

export async function AttractionsSection() {
  let attractions;
  try {
    const res = await attractionsApi.top({ limit: 5 });
    attractions = res.data;
  } catch {
    return null;
  }

  if (!attractions || attractions.length === 0) return null;

  // Split into top row (first 2) and bottom row (next 3)
  const topRow = attractions.slice(0, 2);
  const bottomRow = attractions.slice(2, 5);

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="TOP ATTRACTIONS" />

        {/* Top row - 2 large landscape cards */}
        {topRow.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {topRow.map((attraction) => (
              <ImageCard
                key={attraction.id}
                src={attraction.featured_image || ""}
                alt={attraction.name}
                title={attraction.name}
                href={`/attractions/${attraction.slug}`}
                className="h-[400px]"
              />
            ))}
          </div>
        )}

        {/* Bottom row - 3 smaller cards */}
        {bottomRow.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {bottomRow.map((attraction) => (
              <ImageCard
                key={attraction.id}
                src={attraction.featured_image || ""}
                alt={attraction.name}
                title={attraction.name}
                href={`/attractions/${attraction.slug}`}
                className="h-[220px]"
              />
            ))}
          </div>
        )}

        <ViewMoreButton href="/attractions" />
      </div>
    </section>
  );
}
