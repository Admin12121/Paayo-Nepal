import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { mediaApi } from "@/lib/api-client";

export async function PhotoFeaturesSection() {
  let photos;
  try {
    const res = await mediaApi.gallery({ limit: 5 });
    photos = res.data;
  } catch {
    return null;
  }

  if (!photos || photos.length === 0) return null;

  // Split into top row (first 2) and bottom row (next 3)
  const topRow = photos.slice(0, 2);
  const bottomRow = photos.slice(2, 5);

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="PHOTO FEATURES" />

        {/* Top row - 2 large cards */}
        {topRow.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {topRow.map((photo) => (
              <ImageCard
                key={photo.id}
                src={photo.filename}
                alt={photo.alt || photo.original_name}
                title={photo.caption || photo.original_name}
                className="h-[469px]"
              />
            ))}
          </div>
        )}

        {/* Bottom row - 3 smaller cards */}
        {bottomRow.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {bottomRow.map((photo) => (
              <ImageCard
                key={photo.id}
                src={photo.filename}
                alt={photo.alt || photo.original_name}
                title={photo.caption || photo.original_name}
                className="h-[253px]"
              />
            ))}
          </div>
        )}

        <ViewMoreButton />
      </div>
    </section>
  );
}
