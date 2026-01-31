'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { eventsApi, Event } from '@/lib/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Eye, Share2 } from 'lucide-react';

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

// Related Event Card
function RelatedEventCard({ event }: { event: Event }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Link href={`/events/${event.slug}`}>
      <div className="flex gap-4 group cursor-pointer">
        <div className="w-[140px] h-[90px] rounded-xl overflow-hidden shrink-0 relative">
          {event.featured_image ? (
            <Image
              src={event.featured_image}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              placeholder={event.featured_image_blur ? 'blur' : 'empty'}
              blurDataURL={event.featured_image_blur || undefined}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-xs text-gray-500 mb-1">{formatDate(event.start_date)}</p>
          <h4 className="text-sm font-semibold text-[#1A2B49] leading-snug line-clamp-2 group-hover:text-[#0078C0] transition-colors">
            {event.title}
          </h4>
        </div>
      </div>
    </Link>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchEvent();
      fetchRelatedEvents();
    }
  }, [slug]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getBySlug(slug);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedEvents = async () => {
    try {
      const response = await eventsApi.upcoming({ limit: 5 });
      setRelatedEvents(response.data.filter(e => e.slug !== slug));
    } catch (err) {
      console.error('Failed to fetch related events:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen pt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-[500px] bg-gray-200 rounded-2xl mb-6"></div>
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    notFound();
  }

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Events', href: '/events' },
          { label: event.title }
        ]} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Featured Image */}
            {event.featured_image && (
              <div className="relative h-[500px] w-full rounded-2xl overflow-hidden mb-6">
                <Image
                  src={event.featured_image}
                  alt={event.title}
                  fill
                  className="object-cover"
                  priority
                  placeholder={event.featured_image_blur ? 'blur' : 'empty'}
                  blurDataURL={event.featured_image_blur || undefined}
                />
                {event.is_featured && (
                  <div className="absolute top-6 right-6 px-4 py-2 bg-[#F29C72] text-white text-sm font-semibold rounded-full">
                    Featured Event
                  </div>
                )}
              </div>
            )}

            {/* Event Header */}
            <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-[#1A2B49] mb-6">
                {event.title}
              </h1>

              {/* Event Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-gray-200">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#0078C0] mt-1 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Date</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(event.start_date)}
                      {event.end_date && event.end_date !== event.start_date && (
                        <span className="block text-sm font-normal text-gray-600 mt-1">
                          to {formatDate(event.end_date)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {event.start_time && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-[#0078C0] mt-1 shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Time</p>
                      <p className="font-semibold text-gray-900">
                        {event.start_time}
                        {event.end_time && ` - ${event.end_time}`}
                      </p>
                    </div>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-start gap-3 md:col-span-2">
                    <MapPin className="w-5 h-5 text-[#0078C0] mt-1 shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Location</p>
                      <p className="font-semibold text-gray-900">{event.location}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-2 text-gray-600">
                  <Eye className="w-5 h-5" />
                  <span className="font-medium">{event.views.toLocaleString()} views</span>
                </div>
                <button className="flex items-center gap-2 text-[#0078C0] hover:text-[#0068A0] transition-colors">
                  <Share2 className="w-5 h-5" />
                  <span className="font-medium">Share</span>
                </button>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
                <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                  About This Event
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {event.description}
                </p>
              </div>
            )}

            {/* Content */}
            {event.content && (
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                  Event Details
                </h2>
                <div
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: event.content }}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Quick Info Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6 sticky top-24">
              <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-4">
                Event Information
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                    Upcoming
                  </span>
                </div>
                {event.is_featured && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Featured</p>
                    <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">
                      Featured Event
                    </span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button className="w-full mt-6 py-3 bg-[#0078C0] text-white rounded-full hover:bg-[#0068A0] transition-colors font-semibold">
                Get Directions
              </button>
            </div>

            {/* Related Events */}
            {relatedEvents.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-display text-xl font-bold text-[#1A2B49] mb-6">
                  Related Events
                </h3>
                <div className="space-y-5">
                  {relatedEvents.slice(0, 4).map((relatedEvent) => (
                    <RelatedEventCard key={relatedEvent.id} event={relatedEvent} />
                  ))}
                </div>
                <Link
                  href="/events"
                  className="block text-center mt-6 text-[#0078C0] font-semibold hover:text-[#0068A0] transition-colors"
                >
                  View All Events →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
