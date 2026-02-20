import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { PhotoFeaturesSkeleton } from "@/components/ui/Skeleton";
import { mediaApi } from "@/lib/api-client";

export async function PhotoFeaturesSection() {
  let photos;
  try {
    const res = await mediaApi.gallery({ limit: 5 });
    photos = res.data;
  } catch {
    return <PhotoFeaturesSkeleton />;
  }

  if (!photos || photos.length === 0) return <PhotoFeaturesSkeleton />;

  const lead = photos[0];
  const sideItems = photos.slice(1, 5);

  return (
    <section className="bg-white px-6 py-7 md:py-8">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="PHOTO FEATURES" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {lead ? (
            <ImageCard
              key={lead.id}
              src={
                lead.url || (lead.filename ? `/uploads/${lead.filename}` : "")
              }
              alt={lead.alt || lead.original_name}
              title={lead.caption || lead.original_name}
              href="/photos"
              className="h-[210px] md:col-span-6 md:h-[320px]"
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:col-span-6">
            {sideItems.map((photo) => (
              <ImageCard
                key={photo.id}
                src={
                  photo.url ||
                  (photo.filename ? `/uploads/${photo.filename}` : "")
                }
                alt={photo.alt || photo.original_name}
                title={photo.caption || photo.original_name}
                href="/photos"
                className="h-[100px] md:h-[153px]"
              />
            ))}
          </div>
        </div>

        <ViewMoreButton href="/photos" />
      </div>
    </section>
  );
}
