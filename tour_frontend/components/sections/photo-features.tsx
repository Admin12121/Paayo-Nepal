import { SectionHeading } from "@/components/atoms/section-heading";
import { ImageCard } from "@/components/atoms/image-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { photoFeaturesApi, type PhotoFeature } from "@/lib/api-client";

function pickFirstImage(photo: PhotoFeature): string | null {
  if (photo.cover_image_url) return photo.cover_image_url;
  if (!photo.images || photo.images.length === 0) return null;

  const sorted = [...photo.images].sort(
    (a, b) => a.display_order - b.display_order,
  );
  return sorted[0]?.image_url ?? null;
}

async function resolveCoverImage(photo: PhotoFeature): Promise<string | null> {
  const imageFromPayload = pickFirstImage(photo);
  if (imageFromPayload) return imageFromPayload;

  try {
    const images = await photoFeaturesApi.listImages(photo.id);
    if (!images || images.length === 0) return null;
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    return sorted[0]?.image_url ?? null;
  } catch {
    return null;
  }
}

export async function PhotoFeaturesSection() {
  let photos: Array<PhotoFeature & { coverImage: string | null }> = [];
  try {
    const res = await photoFeaturesApi.list({ limit: 5, status: "published" });
    const photoFeatures = res.data;

    const withCover = await Promise.all(
      photoFeatures.map(async (photo) => ({
        ...photo,
        coverImage: await resolveCoverImage(photo),
      })),
    );
    photos = withCover.filter((photo) => Boolean(photo.coverImage));

    if (photos.length === 0) {
      const fallback = await photoFeaturesApi.list({ limit: 5 });
      const fallbackWithCover = await Promise.all(
        fallback.data.map(async (photo) => ({
          ...photo,
          coverImage: await resolveCoverImage(photo),
        })),
      );
      photos = fallbackWithCover.filter((photo) => Boolean(photo.coverImage));
    }
  } catch {
    photos = [];
  }

  const lead = photos[0];
  const sideItems = photos.slice(1, 5);

  return (
    <section className="bg-white px-6 py-7 md:py-8">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="PHOTO FEATURES" />

        {photos.length === 0 ? (
          <h1 className="text-sm font-medium text-[#6B7280]">
            NO content available
          </h1>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {lead ? (
              <ImageCard
                key={lead.id}
                src={lead.coverImage || ""}
                alt={lead.title}
                title={lead.title}
                href={`/photos?search=${encodeURIComponent(lead.title)}`}
                className="h-[512px] md:col-span-6 md:h-[512px]"
              />
            ) : null}
            <div className="grid grid-cols-2 gap-3 md:col-span-6">
              {sideItems.map((photo) => (
                <ImageCard
                  key={photo.id}
                  src={photo.coverImage || ""}
                  alt={photo.title}
                  title={photo.title}
                  href={`/photos?search=${encodeURIComponent(photo.title)}`}
                  className="h-[250px] md:h-[250px]"
                />
              ))}
            </div>
          </div>
        )}

        <ViewMoreButton href="/photos" />
      </div>
    </section>
  );
}
