import { notFound } from "next/navigation";
import { attractionsApi, Attraction } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, IndianRupee, Star, Eye } from "lucide-react";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { LikeButton } from "@/components/ui/LikeButton";
import { CommentSection } from "@/components/ui/CommentSection";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { prepareContent } from "@/lib/sanitize";
import {
  generateAttractionJsonLd,
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

// Rating Display Component
function RatingDisplay({
  rating,
  reviewCount,
}: {
  rating: number | null;
  reviewCount: number;
}) {
  if (!rating) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-6 h-6 ${
              i < Math.floor(rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
      <span className="text-lg font-semibold text-gray-900">
        {rating.toFixed(1)}
      </span>
      <span className="text-gray-600">({reviewCount} reviews)</span>
    </div>
  );
}

// Opening Hours Component
function OpeningHours({
  hours,
}: {
  hours: Record<string, string | { open: string; close: string } | null> | null;
}) {
  if (!hours) return null;

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-[#0078C0]" />
        Opening Hours
      </h3>
      <div className="space-y-2">
        {days.map((day) => {
          const dayHours = hours[day];
          const isToday = day === today;

          return (
            <div
              key={day}
              className={`flex justify-between text-sm ${
                isToday ? "font-semibold text-[#0078C0]" : "text-gray-700"
              }`}
            >
              <span className="capitalize">{day}</span>
              <span>
                {dayHours
                  ? typeof dayHours === "string"
                    ? dayHours
                    : `${dayHours.open} - ${dayHours.close}`
                  : "Closed"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function AttractionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let attraction: Attraction;

  try {
    attraction = await attractionsApi.getBySlug(slug);
  } catch (error) {
    notFound();
  }

  const attractionJsonLd = generateAttractionJsonLd({
    title: attraction.title,
    description:
      attraction.short_description || attraction.description || undefined,
    slug: attraction.slug,
    coverImage: attraction.cover_image,
    address: attraction.address,
    rating: attraction.rating,
    reviewCount: attraction.review_count,
    latitude: attraction.latitude,
    longitude: attraction.longitude,
    openingHours: attraction.opening_hours,
    entryFee: attraction.entry_fee,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Attractions", href: "/attractions" },
    { name: attraction.title },
  ]);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <script {...jsonLdScriptProps(attractionJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      {/* Invisible view tracker — fires once on mount */}
      <ViewTracker targetType="post" targetId={attraction.id} />

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Attractions", href: "/attractions" },
            { label: attraction.title },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Hero Image */}
            {attraction.cover_image && (
              <div className="relative h-[500px] w-full rounded-2xl overflow-hidden mb-6">
                <Image
                  src={attraction.cover_image}
                  alt={attraction.title}
                  fill
                  className="object-cover"
                  priority
                />
                {attraction.is_featured && (
                  <div className="absolute top-6 right-6 px-4 py-2 bg-[#F29C72] text-white text-sm font-semibold rounded-full flex items-center gap-2">
                    <Star className="w-4 h-4 fill-white" />
                    Top Attraction
                  </div>
                )}
              </div>
            )}

            {/* Title and Rating */}
            {attraction.title && (
              <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-[#1A2B49] mb-4">
                  {attraction.title}
                </h1>

                <RatingDisplay
                  rating={attraction.rating}
                  reviewCount={attraction.review_count}
                />

                {/* Quick Info */}
                <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-gray-200">
                  {attraction.address && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-5 h-5 text-[#0078C0]" />
                      <span>{attraction.address}</span>
                    </div>
                  )}
                  {attraction.entry_fee && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <IndianRupee className="w-5 h-5 text-[#0078C0]" />
                      <span>{attraction.entry_fee}</span>
                    </div>
                  )}
                </div>

                {/* Engagement: views, like button, share */}
                <div className="flex items-center justify-between flex-wrap gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                      <Eye className="w-4 h-4" />
                      <span>{attraction.views.toLocaleString()} views</span>
                    </div>
                    <LikeButton
                      targetType="post"
                      targetId={attraction.id}
                      initialCount={attraction.likes}
                      size="sm"
                    />
                  </div>
                  <ShareButtons
                    title={attraction.title}
                    description={attraction.short_description || undefined}
                    compact
                  />
                </div>
              </div>
            )}

            {/* Description */}
            {attraction.description && (
              <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
                <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                  About
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {attraction.description}
                </p>
              </div>
            )}

            {/* Content */}
            {!!attraction.content && (
              <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
                <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                  Details
                </h2>
                <div
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: prepareContent(attraction.content),
                  }}
                />
              </div>
            )}

            {/* Location Map */}
            <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                Location
              </h2>
              <div className="bg-gray-100 rounded-xl p-12 text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">
                  Interactive map coming soon
                </p>
                {attraction.latitude && attraction.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${attraction.latitude},${attraction.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-medium"
                  >
                    View on Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <CommentSection targetType="post" targetId={attraction.id} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Opening Hours */}
            {attraction.opening_hours && (
              <OpeningHours hours={attraction.opening_hours} />
            )}

            {/* Quick Facts */}
            <div
              className={`bg-white rounded-xl p-6 shadow-sm ${attraction.opening_hours ? "mt-6" : ""}`}
            >
              <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-4">
                Quick Facts
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Views</span>
                  <span className="font-semibold text-gray-900">
                    {attraction.views.toLocaleString()}
                  </span>
                </div>
                {attraction.rating && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Rating</span>
                    <span className="font-semibold text-gray-900">
                      {attraction.rating.toFixed(1)} / 5.0
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Reviews</span>
                  <span className="font-semibold text-gray-900">
                    {attraction.review_count}
                  </span>
                </div>
                {attraction.entry_fee && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Entry Fee</span>
                    <span className="font-semibold text-gray-900">
                      {attraction.entry_fee}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Likes</span>
                  <span className="font-semibold text-gray-900">
                    {attraction.likes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Share Section */}
            <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
              <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-4">
                Share this attraction
              </h3>
              <ShareButtons
                title={attraction.title}
                description={attraction.short_description || undefined}
              />
            </div>
          </div>
        </div>
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
    const attraction = await attractionsApi.getBySlug(slug);

    const description =
      attraction.short_description ||
      `Discover ${attraction.title}, a must-visit attraction in Nepal`;

    return {
      title: `${attraction.title} — Nepal Attractions`,
      description,
      openGraph: {
        title: attraction.title,
        description,
        url: `${BASE_URL}/attractions/${slug}`,
        type: "article",
        images: attraction.cover_image ? [attraction.cover_image] : [],
      },
      twitter: {
        card: "summary_large_image" as const,
        title: attraction.title,
        description,
        images: attraction.cover_image ? [attraction.cover_image] : [],
      },
      alternates: {
        canonical: `${BASE_URL}/attractions/${slug}`,
      },
    };
  } catch (error) {
    return {
      title: "Attraction Not Found",
    };
  }
}
