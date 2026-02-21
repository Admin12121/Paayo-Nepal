"use client";

import { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import { eventsApi, Event } from "@/lib/api-client";
import { contentLinksApi, postsApi } from "@/lib/api-client";
import Link from "@/components/ui/animated-link";
import { Calendar, Clock, MapPin, Eye } from "lucide-react";
import { useViewTracker } from "@/lib/hooks/use-view-tracker";
import { LikeButton } from "@/components/ui/LikeButton";
import { CommentSection } from "@/components/ui/CommentSection";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { prepareContent } from "@/lib/sanitize";
import { normalizeMediaUrl } from "@/lib/media-url";
import { NumberTicker } from "@/components/ui/number-ticker";

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

// Related Event Card
function RelatedEventCard({ event }: { event: Event }) {
  const coverImage = normalizeMediaUrl(event.cover_image);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link href={`/events/${event.slug}`}>
      <div className="flex gap-4 group cursor-pointer">
        <div className="w-[140px] h-[90px] rounded-xl overflow-hidden shrink-0 relative">
          {coverImage ? (
            <img
              src={coverImage}
              alt={event.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-xs text-gray-500 mb-1">
            {event.event_date ? formatDate(event.event_date) : "TBD"}
          </p>
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

  // Track the page view once the event is loaded
  useViewTracker("post", event?.id);

  useEffect(() => {
    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getBySlug(slug);
      setEvent(data);
      await fetchRelatedEvents(data.id, slug);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedEvents = async (eventId: string, currentSlug: string) => {
    try {
      const links = await contentLinksApi.listForSource("post", eventId);
      const linkedPostIds = links
        .filter((link) => link.target_type === "post")
        .map((link) => link.target_id);

      if (linkedPostIds.length > 0) {
        const response = await postsApi.list({
          limit: 100,
          status: "published",
          type: "event",
        });
        const order = new Map(linkedPostIds.map((id, idx) => [id, idx]));
        const linkedEvents = response.data
          .filter((item) => order.has(item.id) && item.slug !== currentSlug)
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        setRelatedEvents(linkedEvents.slice(0, 5));
        return;
      }

      const fallback = await eventsApi.upcoming({ limit: 5 });
      setRelatedEvents(fallback.data.filter((e) => e.slug !== currentSlug));
    } catch (err) {
      console.error("Failed to fetch related events:", err);
      try {
        const fallback = await eventsApi.upcoming({ limit: 5 });
        setRelatedEvents(fallback.data.filter((e) => e.slug !== currentSlug));
      } catch {
        setRelatedEvents([]);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
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

  const eventCoverImage = normalizeMediaUrl(event.cover_image);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Events", href: "/events" },
            { label: event.title },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Featured Image */}
            {eventCoverImage && (
              <div className="relative h-[500px] w-full rounded-2xl overflow-hidden mb-6">
                <img
                  src={eventCoverImage}
                  alt={event.title}
                  className="h-full w-full object-cover"
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
                      {event.event_date ? formatDate(event.event_date) : "TBD"}
                      {event.event_end_date &&
                        event.event_end_date !== event.event_date && (
                          <span className="block text-sm font-normal text-gray-600 mt-1">
                            to {formatDate(event.event_end_date)}
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
                      <p className="font-semibold text-gray-900">
                        {event.location}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Engagement: views, like, share */}
              <div className="flex items-center justify-between flex-wrap gap-4 mt-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                    <Eye className="w-4 h-4" />
                    <span className="font-medium">
                      <NumberTicker
                        value={event.views ?? 0}
                        className="tracking-normal text-current dark:text-current"
                      />{" "}
                      views
                    </span>
                  </div>
                  <LikeButton
                    targetType="post"
                    targetId={event.id}
                    initialCount={event.likes}
                    size="sm"
                  />
                </div>
                <ShareButtons
                  title={event.title}
                  description={event.short_description || undefined}
                  compact
                />
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
            {!!event.content && (
              <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm">
                <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-4">
                  Event Details
                </h2>
                <div
                  className="rich-content max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: prepareContent(event.content),
                  }}
                />
              </div>
            )}

            {/* Comments Section */}
            <CommentSection targetType="post" targetId={event.id} />
          </div>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {relatedEvents.length > 0 && (
              <div className="flex flex-col rounded-xl bg-white p-5 shadow-sm lg:h-[calc(100vh-7rem)]">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-5 uppercase tracking-wide">
                  Related Events
                </h3>
                <div className="space-y-4 overflow-y-auto pr-1">
                  {relatedEvents.slice(0, 10).map((relatedEvent) => (
                    <RelatedEventCard
                      key={relatedEvent.id}
                      event={relatedEvent}
                    />
                  ))}
                </div>
                <Link
                  href="/events"
                  className="mt-4 block text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0078C0] hover:text-[#0068A0]"
                >
                  View All
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
