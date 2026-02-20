import Link from "@/components/ui/animated-link";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { hotelsApi, type Hotel, type HotelBranch } from "@/lib/api-client";
import { normalizeMediaUrl } from "@/lib/media-url";

const QUICK_LINKS = [
  { label: "Stays", href: "/search?q=stays" },
  { label: "Flights", href: "/search?q=flights" },
  { label: "Vehicle Rental", href: "/search?q=vehicle-rental" },
  { label: "Handicrafts", href: "/search?q=handicrafts" },
  { label: "Shopping", href: "/search?q=shopping" },
  { label: "Organic Products", href: "/search?q=organic-products" },
] as const;

const ICON_CLASS = "h-3.5 w-3.5 shrink-0 text-[#637396]";

function parseGalleryImages(gallery: unknown): string[] {
  if (!Array.isArray(gallery)) return [];
  return gallery
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeMediaUrl(item))
    .filter((item): item is string => Boolean(item));
}

function websiteHost(website?: string | null): string {
  if (!website) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//i, "");
  }
}

export async function InfoUpdatesSection() {
  let hotels: Hotel[] = [];

  try {
    const response = await hotelsApi.list({
      limit: 4,
      status: "published",
    });
    hotels = response.data;
  } catch {
    hotels = [];
  }

  if (hotels.length === 0) return null;

  const cards = await Promise.all(
    hotels.map(async (hotel) => {
      let branches: HotelBranch[] = [];
      try {
        branches = await hotelsApi.getBranches(hotel.id);
      } catch {
        branches = [];
      }

      const mainBranch = branches.find((branch) => branch.is_main) || branches[0];
      const previewImages = Array.from(
        new Set(
          [normalizeMediaUrl(hotel.cover_image), ...parseGalleryImages(hotel.gallery)].filter(
            Boolean,
          ),
        ),
      ) as string[];

      return { hotel, branches, mainBranch, previewImages };
    }),
  );

  return (
    <section className="bg-[#F3F6FA] px-6 py-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-full border border-[#D5D8E1] px-4 py-2 text-[11px] font-semibold tracking-[0.04em] text-[#4A5876] transition-colors hover:border-[#0078C0] hover:text-[#0078C0]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ hotel, branches, mainBranch, previewImages }) => (
            <article
              key={hotel.id}
              className="overflow-hidden rounded-xl border border-[#E7ECF4] bg-white"
            >
              <Link href={`/hotels/${hotel.slug}`} className="block h-[220px] w-full bg-[#EEF2F8]">
                {normalizeMediaUrl(hotel.cover_image) ? (
                  <img
                    src={normalizeMediaUrl(hotel.cover_image) || ""}
                    alt={hotel.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#E6EEF8] to-[#CCDDF1]">
                    <span className="text-sm font-semibold text-[#48638D]">No image</span>
                  </div>
                )}
              </Link>

              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex items-center gap-1">
                  {previewImages.slice(0, 3).map((image, index) => (
                    <img
                      key={`${hotel.id}-${index}`}
                      src={image}
                      alt={`${hotel.name} preview ${index + 1}`}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ))}
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E8F2FD] text-[#0A79C1]">
                    <MapPin className="h-4 w-4" />
                  </div>
                </div>
                <span className="ml-auto text-xs font-semibold text-[#6B7897]">
                  1/{Math.max(previewImages.length, 1)}
                </span>
              </div>

              <div className="space-y-2 px-3 pb-3">
                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#1A2B49]">
                  {hotel.name}
                </h3>

                <p className="flex items-start gap-2 text-xs text-[#384B72]">
                  <MapPin className={ICON_CLASS} />
                  <span className="line-clamp-2">
                    {mainBranch?.address || "Address not available"}
                  </span>
                </p>

                {mainBranch?.phone || hotel.phone ? (
                  <p className="flex items-start gap-2 text-xs text-[#384B72]">
                    <Phone className={ICON_CLASS} />
                    <span className="line-clamp-2">{mainBranch?.phone || hotel.phone}</span>
                  </p>
                ) : null}

                {mainBranch?.email || hotel.email ? (
                  <p className="flex items-start gap-2 text-xs text-[#384B72]">
                    <Mail className={ICON_CLASS} />
                    <span className="line-clamp-1">{mainBranch?.email || hotel.email}</span>
                  </p>
                ) : null}

                {hotel.website ? (
                  <p className="flex items-start gap-2 text-xs text-[#384B72]">
                    <Globe className={ICON_CLASS} />
                    <span className="line-clamp-1">{websiteHost(hotel.website)}</span>
                  </p>
                ) : null}

                <Link
                  href={`/hotels/${hotel.slug}`}
                  className="mt-2 inline-flex h-7 w-full items-center justify-center rounded bg-[#0A79C1] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0969A8]"
                >
                  Branch Network
                </Link>

                <p className="text-center text-[11px] font-medium text-[#6B7897]">
                  {branches.length} {branches.length === 1 ? "branch" : "branches"}
                </p>
              </div>
            </article>
          ))}
        </div>

        <ViewMoreButton href="/hotels" />
      </div>
    </section>
  );
}
