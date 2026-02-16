import { notFound } from "next/navigation";
import { regionsApi, Region, Attraction } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import {
  generateRegionJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
} from "@/lib/seo";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

// Breadcrumbs Component
function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-[#0078C0] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#0078C0] font-medium">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

// Attraction Card Component
function AttractionCard({ attraction }: { attraction: Attraction }) {
  return (
    <Link href={`/attractions/${attraction.slug}`}>
      <div
        className="bg-white rounded-[20px] overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl"
        style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
      >
        <div className="overflow-hidden rounded-[16px] h-[240px] relative">
          {attraction.cover_image ? (
            <Image
              src={attraction.cover_image}
              alt={attraction.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <MapPin className="w-12 h-12 text-gray-400" />
            </div>
          )}
          {attraction.is_featured && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-[#F29C72] text-white text-xs font-semibold rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-white" />
              Top
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-display text-lg font-semibold text-[#1A2B49] mb-2 line-clamp-2">
            {attraction.title}
          </h3>
          {attraction.short_description && (
            <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
              {attraction.short_description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function RegionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let region: Region;
  let attractions: Attraction[] = [];

  try {
    region = await regionsApi.getBySlug(slug);

    // Fetch attractions for this region
    try {
      const attractionsResponse = await regionsApi.getAttractions(slug, {
        limit: 12,
      });
      attractions = attractionsResponse.data;
    } catch (err) {
      console.error("Failed to fetch attractions:", err);
    }
  } catch (error) {
    notFound();
  }

  const regionJsonLd = generateRegionJsonLd({
    name: region.name,
    description: region.description || undefined,
    slug: slug,
    coverImage: region.cover_image,
    province: region.province || null,
    latitude: region.latitude || null,
    longitude: region.longitude || null,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Regions", href: "/regions" },
    { name: region.name },
  ]);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <script {...jsonLdScriptProps(regionJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Regions", href: "/regions" },
            { label: region.name },
          ]}
        />

        {/* Hero Section */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-10">
          {region.cover_image && (
            <div className="relative h-[400px] w-full">
              <Image
                src={region.cover_image}
                alt={region.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="flex items-center gap-3 mb-3">
                  {region.province && (
                    <span className="text-sm font-semibold text-white bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
                      {region.province}
                    </span>
                  )}
                  {region.district && (
                    <span className="text-sm text-white/90">
                      {region.district}
                    </span>
                  )}
                </div>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-white">
                  {region.name}
                </h1>
              </div>
            </div>
          )}

          <div className="p-8">
            {/* Location Info */}
            {(region.latitude || region.longitude) && (
              <div className="flex items-center gap-2 text-gray-600 mb-6">
                <MapPin className="w-5 h-5 text-[#0078C0]" />
                <span>
                  Coordinates: {region.latitude?.toFixed(4)},{" "}
                  {region.longitude?.toFixed(4)}
                </span>
              </div>
            )}

            {/* Description */}
            {region.description && (
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed text-lg">
                  {region.description}
                </p>
              </div>
            )}

            {/* Map Placeholder */}
            <div className="mt-8 bg-gray-100 rounded-xl p-8 text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Interactive map coming soon</p>
              {region.latitude && region.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${region.latitude},${region.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-6 py-2 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
                >
                  View on Google Maps
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Related Attractions */}
        {attractions.length > 0 && (
          <div>
            <h2 className="font-display text-3xl font-bold text-[#1A2B49] mb-6">
              Attractions in {region.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attractions.map((attraction) => (
                <AttractionCard key={attraction.id} attraction={attraction} />
              ))}
            </div>

            {attractions.length >= 12 && (
              <div className="flex justify-center mt-8">
                <Link
                  href={`/attractions?region=${region.id}`}
                  className="px-8 py-3 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
                >
                  View All Attractions
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const region = await regionsApi.getBySlug(slug);

    const description =
      region.description ||
      `Discover ${region.name}, a beautiful region in Nepal`;

    return {
      title: `${region.name} — Explore Nepal Regions`,
      description,
      openGraph: {
        title: region.name,
        description,
        url: `${BASE_URL}/regions/${slug}`,
        type: "article",
        images: region.cover_image ? [region.cover_image] : [],
      },
      twitter: {
        card: "summary_large_image" as const,
        title: region.name,
        description,
        images: region.cover_image ? [region.cover_image] : [],
      },
      alternates: {
        canonical: `${BASE_URL}/regions/${slug}`,
      },
    };
  } catch (error) {
    return {
      title: "Region Not Found",
    };
  }
}
