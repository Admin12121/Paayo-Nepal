import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { attractionsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export async function AttractionsSection() {
  let attractions: Awaited<ReturnType<typeof attractionsApi.list>>["data"] = [];
  try {
    const res = await attractionsApi.top({ limit: 5 });
    attractions = res.data;

    // Fallback when no attraction is marked as featured yet.
    if (attractions.length === 0) {
      const featured = await attractionsApi.list({ limit: 5, is_featured: true });
      attractions = featured.data;
    }

    // Final fallback: latest published attractions.
    if (attractions.length === 0) {
      const latest = await attractionsApi.list({ limit: 5 });
      attractions = latest.data;
    }
  } catch {
    attractions = [];
  }

  const featured = attractions[0];
  const sideItems = attractions.slice(1, 5);
  const hasSideItems = sideItems.length > 0;

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="TOP ATTRACTIONS" />

        {attractions.length === 0 ? (
          <h1 className="text-sm font-medium text-[#6B7280]">
            NO content available
          </h1>
        ) : (
          <div
            className={cn(
              "mb-5 grid grid-cols-1 gap-5",
              hasSideItems
                ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
                : "lg:grid-cols-1",
            )}
          >
            {featured ? (
              <ImageCard
                key={featured.id}
                src={featured.cover_image || ""}
                alt={featured.title}
                title={featured.title}
                href={`/attractions/${featured.slug}`}
                className=""
              />
            ) : null}
            {hasSideItems ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {sideItems.map((attraction) => (
                  <ImageCard
                    key={attraction.id}
                    src={attraction.cover_image || ""}
                    alt={attraction.title}
                    title={attraction.title}
                    href={`/attractions/${attraction.slug}`}
                    className=""
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <ViewMoreButton href="/attractions" />
      </div>
    </section>
  );
}
