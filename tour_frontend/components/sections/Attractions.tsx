import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { attractionsApi } from "@/lib/api-client";

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

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="TOP ATTRACTIONS" />

        {attractions.length === 0 ? (
          <h1 className="text-sm font-medium text-[#6B7280]">
            NO content available
          </h1>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
        )}

        <ViewMoreButton href="/attractions" />
      </div>
    </section>
  );
}
