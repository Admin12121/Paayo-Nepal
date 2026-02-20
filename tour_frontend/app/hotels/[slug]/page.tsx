"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import {
  Eye,
  MapPin,
  Star,
  Phone,
  Mail,
  Globe,
  Calendar,
  IndianRupee,
  Building2,
  ChevronRight,
} from "lucide-react";
import { hotelsApi, Hotel, HotelBranch } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { useViewTracker } from "@/lib/hooks/use-view-tracker";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { normalizeMediaUrl } from "@/lib/media-url";

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

function RelatedHotelCard({ hotel }: { hotel: Hotel }) {
  const normalizedCoverImage = normalizeMediaUrl(hotel.cover_image);

  const getPriceSymbol = (range: string | null) => {
    switch (range) {
      case "budget":
        return "रु";
      case "mid":
        return "रु रु";
      case "luxury":
        return "रु रु रु";
      default:
        return "—";
    }
  };

  return (
    <Link href={`/hotels/${hotel.slug}`}>
      <div className="group cursor-pointer">
        <div className="rounded-[10px] overflow-hidden aspect-[4/3] mb-2 relative bg-gray-200">
          {normalizedCoverImage ? (
            <img
              src={normalizedCoverImage}
              alt={hotel.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <Building2 className="w-8 h-8 text-gray-300" />
            </div>
          )}
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold text-green-700">
            {getPriceSymbol(hotel.price_range)}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
          <span>
            {hotel.star_rating ? "★".repeat(hotel.star_rating) : "No rating"}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {hotel.view_count}
          </span>
        </div>
        <h4 className="font-display text-sm font-semibold text-[#1A2B49] leading-snug line-clamp-2 group-hover:text-[#0078C0] transition-colors">
          {hotel.name}
        </h4>
      </div>
    </Link>
  );
}

function BranchCard({ branch }: { branch: HotelBranch }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-[#0078C0]/30 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MapPin className="w-5 h-5 text-[#0078C0]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900">
              {branch.name}
            </h4>
            {branch.is_main && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Main
              </span>
            )}
          </div>
          {branch.address && (
            <p className="text-sm text-gray-500 mb-2">{branch.address}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {branch.phone && (
              <a
                href={`tel:${branch.phone}`}
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#0078C0] transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {branch.phone}
              </a>
            )}
            {branch.email && (
              <a
                href={`mailto:${branch.email}`}
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#0078C0] transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {branch.email}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotelDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [branches, setBranches] = useState<HotelBranch[]>([]);
  const [relatedHotels, setRelatedHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Track the page view once the hotel is loaded
  useViewTracker("hotel", hotel?.id);

  useEffect(() => {
    if (slug) {
      fetchHotel();
      fetchRelatedHotels();
    }
  }, [slug]);

  const fetchHotel = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await hotelsApi.getBySlug(slug);
      setHotel(data);

      // Fetch branches after hotel is loaded
      setBranchesLoading(true);
      try {
        const branchData = await hotelsApi.getBranches(data.id);
        setBranches(branchData);
      } catch {
        // Branches might not exist — that's fine
        setBranches([]);
      } finally {
        setBranchesLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load hotel");
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedHotels = async () => {
    try {
      const response = await hotelsApi.list({
        limit: 6,
        status: "published",
      });
      setRelatedHotels(response.data.filter((h) => h.slug !== slug));
    } catch (err) {
      console.error("Failed to fetch related hotels:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen pt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-[400px] bg-gray-200 rounded-2xl mb-6" />
            <div className="h-6 bg-gray-200 rounded w-full mb-2" />
            <div className="h-6 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !hotel) {
    notFound();
  }

  const getPriceInfo = (range: string | null) => {
    switch (range) {
      case "budget":
        return {
          label: "Budget",
          symbol: "रु",
          color: "text-green-700 bg-green-50 border-green-200",
        };
      case "mid":
        return {
          label: "Mid-range",
          symbol: "रु रु",
          color: "text-blue-700 bg-blue-50 border-blue-200",
        };
      case "luxury":
        return {
          label: "Luxury",
          symbol: "रु रु रु",
          color: "text-purple-700 bg-purple-50 border-purple-200",
        };
      default:
        return {
          label: "N/A",
          symbol: "—",
          color: "text-gray-700 bg-gray-50 border-gray-200",
        };
    }
  };

  const priceInfo = getPriceInfo(hotel.price_range);

  const amenitiesList: string[] =
    hotel.amenities && Array.isArray(hotel.amenities)
      ? (hotel.amenities as string[])
      : [];
  const phoneNumbers =
    hotel.phone
      ?.split(/[,;\n]+/)
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  const galleryImages: string[] =
    hotel.gallery && Array.isArray(hotel.gallery)
      ? (hotel.gallery as string[])
          .map((img) => normalizeMediaUrl(img))
          .filter((img): img is string => Boolean(img))
      : [];
  const normalizedCoverImage = normalizeMediaUrl(hotel.cover_image);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Hotels", href: "/hotels" },
            { label: hotel.name },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Hotel Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
                <div>
                  <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#1A2B49] leading-tight">
                    {hotel.name}
                  </h1>

                  {/* Star rating */}
                  {hotel.star_rating && (
                    <div className="flex items-center gap-1 mt-2">
                      {Array.from({ length: hotel.star_rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-5 h-5 text-yellow-400 fill-yellow-400"
                        />
                      ))}
                      {Array.from({ length: 5 - hotel.star_rating }).map(
                        (_, i) => (
                          <Star
                            key={`empty-${i}`}
                            className="w-5 h-5 text-gray-200"
                          />
                        ),
                      )}
                      <span className="text-sm text-gray-500 ml-2">
                        {hotel.star_rating}-star hotel
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className={`px-4 py-2 rounded-xl border text-sm font-bold ${priceInfo.color}`}
                >
                  <IndianRupee className="w-4 h-4 inline mr-1" />
                  {priceInfo.symbol} — {priceInfo.label}
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 text-sm text-[#868383]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(
                      hotel.published_at || hotel.created_at,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {hotel.is_featured && (
                    <>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        Featured
                      </span>
                    </>
                  )}
                </div>
                <ShareButtons
                  title={hotel.name}
                  description={hotel.description || undefined}
                  compact
                />
              </div>
            </div>

            {/* Cover Image */}
            {normalizedCoverImage && (
              <div className="rounded-2xl overflow-hidden mb-6 relative h-[400px] md:h-[500px] shadow-lg">
                <Image
                  src={normalizedCoverImage}
                  alt={hotel.name}
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>
            )}

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div className="mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                  Gallery
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {galleryImages.map((img, index) => (
                    <div
                      key={index}
                      className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100"
                    >
                      <img
                        src={img}
                        alt={`${hotel.name} gallery ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {hotel.description && (
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-3">
                  About this Hotel
                </h3>
                <div className="text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                  {hotel.description}
                </div>
              </div>
            )}

            {/* Amenities */}
            {amenitiesList.length > 0 && (
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                  Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {amenitiesList.map((amenity, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium border border-gray-100"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Branches / Locations */}
            {branches.length > 0 && (
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#0078C0]" />
                  Locations & Branches
                  <span className="text-sm font-normal text-gray-500">
                    ({branches.length})
                  </span>
                </h3>
                <div className="space-y-3">
                  {branches
                    .sort((a, b) =>
                      a.is_main === b.is_main ? 0 : a.is_main ? -1 : 1,
                    )
                    .map((branch) => (
                      <BranchCard key={branch.id} branch={branch} />
                    ))}
                </div>
              </div>
            )}

            {branchesLoading && (
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="space-y-3">
                  <div className="h-20 bg-gray-100 rounded-xl" />
                  <div className="h-20 bg-gray-100 rounded-xl" />
                </div>
              </div>
            )}

            {/* Engagement Stats */}
            <div className="flex items-center justify-between flex-wrap gap-4 py-4 border-t border-b border-gray-200 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[#868383] text-sm">
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">
                    {hotel.view_count.toLocaleString()} views
                  </span>
                </div>
              </div>
              <ShareButtons
                title={hotel.name}
                description={hotel.description || undefined}
                compact
              />
            </div>

          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Contact Info Card */}
            {(hotel.phone || hotel.email || hotel.website) && (
              <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                  Contact
                </h3>
                <div className="space-y-3">
                  {phoneNumbers.map((phone, index) => (
                    <a
                      key={`${phone}-${index}`}
                      href={`tel:${phone}`}
                      className="flex items-center gap-3 text-sm text-gray-700 hover:text-[#0078C0] transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Phone className="w-4 h-4 text-[#0078C0]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">
                          {index === 0 ? "Phone" : `Phone ${index + 1}`}
                        </p>
                        <p className="font-medium">{phone}</p>
                      </div>
                    </a>
                  ))}
                  {hotel.email && (
                    <a
                      href={`mailto:${hotel.email}`}
                      className="flex items-center gap-3 text-sm text-gray-700 hover:text-[#0078C0] transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Mail className="w-4 h-4 text-[#0078C0]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="font-medium">{hotel.email}</p>
                      </div>
                    </a>
                  )}
                  {hotel.website && (
                    <a
                      href={hotel.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-gray-700 hover:text-[#0078C0] transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Globe className="w-4 h-4 text-[#0078C0]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Website</p>
                        <p className="font-medium truncate max-w-[180px]">
                          {hotel.website.replace(/^https?:\/\//, "")}
                        </p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Quick Info Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                Quick Info
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Price Range</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${priceInfo.color}`}
                  >
                    {priceInfo.symbol} {priceInfo.label}
                  </span>
                </div>
                {hotel.star_rating && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Rating</span>
                    <span className="text-yellow-500 font-medium">
                      {"★".repeat(hotel.star_rating)} {hotel.star_rating}/5
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Views</span>
                  <span className="text-gray-700 font-medium">
                    {hotel.view_count.toLocaleString()}
                  </span>
                </div>
                {branches.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Locations</span>
                    <span className="text-gray-700 font-medium">
                      {branches.length} branch
                      {branches.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Share card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                Share this hotel
              </h3>
              <ShareButtons
                title={hotel.name}
                description={hotel.description || undefined}
              />
            </div>

            {/* Related Hotels */}
            {relatedHotels.length > 0 && (
              <>
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
                  MORE HOTELS
                </h3>
                <div className="space-y-6">
                  {relatedHotels.slice(0, 5).map((h) => (
                    <RelatedHotelCard key={h.id} hotel={h} />
                  ))}
                </div>
                {relatedHotels.length > 5 && (
                  <Link
                    href="/hotels"
                    className="block mt-6 text-center text-[#0078C0] font-semibold hover:text-[#0068A0] transition-colors"
                  >
                    View All Hotels →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
