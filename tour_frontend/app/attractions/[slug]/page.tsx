import { notFound } from 'next/navigation';
import { attractionsApi, Attraction } from '@/lib/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Clock, DollarSign, Star, MessageSquare } from 'lucide-react';

// Breadcrumbs Component
function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="hover:text-[#0078C0] transition-colors">
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
function RatingDisplay({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  if (!rating) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-6 h-6 ${
              i < Math.floor(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
      <span className="text-lg font-semibold text-gray-900">
        {rating.toFixed(1)}
      </span>
      <span className="text-gray-600">
        ({reviewCount} reviews)
      </span>
    </div>
  );
}

// Opening Hours Component
function OpeningHours({ hours }: { hours: Record<string, { open: string; close: string }> | null }) {
  if (!hours) return null;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
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
                isToday ? 'font-semibold text-[#0078C0]' : 'text-gray-700'
              }`}
            >
              <span className="capitalize">{day}</span>
              <span>
                {dayHours ? `${dayHours.open} - ${dayHours.close}` : 'Closed'}
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

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Attractions', href: '/attractions' },
          { label: attraction.name }
        ]} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Hero Image */}
            {attraction.featured_image && (
              <div className="relative h-[500px] w-full rounded-2xl overflow-hidden mb-6">
                <Image
                  src={attraction.featured_image}
                  alt={attraction.name}
                  fill
                  className="object-cover"
                  priority
                  placeholder={attraction.featured_image_blur ? 'blur' : 'empty'}
                  blurDataURL={attraction.featured_image_blur || undefined}
                />
                {attraction.is_top_attraction && (
                  <div className="absolute top-6 right-6 px-4 py-2 bg-[#F29C72] text-white text-sm font-semibold rounded-full flex items-center gap-2">
                    <Star className="w-4 h-4 fill-white" />
                    Top Attraction
                  </div>
                )}
              </div>
            )}

            {/* Title and Rating */}
            <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-[#1A2B49] mb-4">
                {attraction.name}
              </h1>

              <RatingDisplay rating={attraction.rating} reviewCount={attraction.review_count} />

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
                    <DollarSign className="w-5 h-5 text-[#0078C0]" />
                    <span>{attraction.entry_fee}</span>
                  </div>
                )}
              </div>
            </div>

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
            {attraction.content && (
              <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
                <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                  Details
                </h2>
                <div
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: attraction.content }}
                />
              </div>
            )}

            {/* Location Map */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                Location
              </h2>
              <div className="bg-gray-100 rounded-xl p-12 text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">Interactive map coming soon</p>
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

            {/* Reviews Section Placeholder */}
            <div className="bg-white rounded-2xl p-8 mt-6 shadow-sm">
              <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-[#0078C0]" />
                Reviews
              </h2>
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">Reviews feature coming soon</p>
                <p className="text-sm text-gray-500 mt-2">
                  {attraction.review_count} reviews available
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Opening Hours */}
            {attraction.opening_hours && (
              <OpeningHours hours={attraction.opening_hours} />
            )}

            {/* Quick Facts */}
            <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
              <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-4">
                Quick Facts
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Views</span>
                  <span className="font-semibold text-gray-900">{attraction.views.toLocaleString()}</span>
                </div>
                {attraction.rating && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Rating</span>
                    <span className="font-semibold text-gray-900">{attraction.rating.toFixed(1)} / 5.0</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Reviews</span>
                  <span className="font-semibold text-gray-900">{attraction.review_count}</span>
                </div>
                {attraction.entry_fee && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Entry Fee</span>
                    <span className="font-semibold text-gray-900">{attraction.entry_fee}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Share Section */}
            <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
              <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-4">
                Share this attraction
              </h3>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  Facebook
                </button>
                <button className="flex-1 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm font-medium">
                  Twitter
                </button>
              </div>
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

    return {
      title: `${attraction.name} - Nepal Attractions`,
      description: attraction.description || `Discover ${attraction.name}, a must-visit attraction in Nepal`,
      openGraph: {
        title: attraction.name,
        description: attraction.description,
        images: attraction.featured_image ? [attraction.featured_image] : [],
      },
    };
  } catch (error) {
    return {
      title: 'Attraction Not Found',
    };
  }
}
