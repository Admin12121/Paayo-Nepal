"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Clock } from "lucide-react";
import { eventsApi, Event, postsApi, regionsApi, Region } from "@/lib/api-client";
import Link from "@/components/ui/animated-link";
import { normalizeMediaUrl } from "@/lib/media-url";

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-5 flex items-center gap-2 text-xs text-[#6A7898]">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-[#0078C0]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#0078C0]">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getComparableDate(event: Event) {
  return new Date(event.event_date || event.created_at).getTime();
}

function EventCard({ event }: { event: Event }) {
  const coverImage = normalizeMediaUrl(event.cover_image);

  return (
    <Link href={`/events/${event.slug}`}>
      <article
        className="group cursor-pointer overflow-hidden rounded-[20px] bg-white transition-all duration-300 hover:shadow-xl"
        style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
      >
        <div className="relative h-[320px] overflow-hidden rounded-[16px]">
          {coverImage ? (
            <img
              src={coverImage}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#DCE2EE]">
              <Calendar className="h-10 w-10 text-[#97A5BF]" />
            </div>
          )}

          {event.is_featured && (
            <span className="absolute right-4 top-4 rounded-full bg-[#F29C72] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white">
              Featured
            </span>
          )}
        </div>

        <div className="p-6">
          <h3 className="mb-3 line-clamp-2 text-center font-display text-2xl font-semibold text-[#1A2B49]">
            {event.title}
          </h3>

          {event.short_description && (
            <p className="line-clamp-3 text-center text-sm leading-relaxed text-gray-600">
              {event.short_description}
            </p>
          )}

          <div className="mt-4 space-y-1.5 text-xs text-[#516482]">
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#0078C0]" />
                          {event.event_date
              ? formatDate(event.event_date)
              : `${new Date(
                  event.published_at || event.created_at,
                ).toLocaleDateString()}`}
            </p>
            {event.start_time ? (
              <p className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#0078C0]" />
                {event.start_time}
                {event.end_time ? ` - ${event.end_time}` : ""}
              </p>
            ) : null}
            {event.location ? (
              <p className="line-clamp-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#0078C0]" />
                {event.location}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}

function EventCardSkeleton() {
  return (
    <div
      className="animate-pulse overflow-hidden rounded-[20px] bg-white"
      style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
    >
      <div className="h-[320px] bg-gray-200" />
      <div className="p-6">
        <div className="mx-auto mb-3 h-7 w-3/4 rounded bg-gray-200" />
        <div className="mb-2 h-4 w-full rounded bg-gray-200" />
        <div className="mx-auto h-4 w-2/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const limit = 9;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [regionsRes, eventsRes] = await Promise.all([
          regionsApi.list({ limit: 100 }),
          eventsApi.list({ limit: 200 }),
        ]);

        let events = eventsRes.data;
        if (events.length === 0) {
          const fallback = await postsApi.list({
            limit: 200,
            type: "event",
            status: "published",
          });
          events = fallback.data as Event[];
        }

        const sortedEvents = [...events].sort(
          (a, b) => getComparableDate(b) - getComparableDate(a),
        );

        setAllEvents(sortedEvents);
        setRegions(regionsRes.data);
      } catch (err) {
        console.error("Failed to load events page:", err);
        setAllEvents([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const featuredEvents = useMemo(
    () => allEvents.filter((event) => event.is_featured).slice(0, 3),
    [allEvents],
  );

  const filteredEvents = useMemo(() => {
    if (selectedRegion === "all") return allEvents;
    return allEvents.filter((event) => event.region_id === selectedRegion);
  }, [allEvents, selectedRegion]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / limit));

  const pageEvents = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredEvents.slice(start, start + limit);
  }, [filteredEvents, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-[#EEF1F6] pt-20">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events" }]} />

        <div className="mb-7">
          <h1 className="font-display text-[40px] font-semibold text-[#1A2B49] md:text-[46px]">
            Events and Festivals
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#6A7898] md:text-base">
            Explore upcoming festivals, cultural celebrations, and tourism events happening across Nepal.
          </p>
        </div>

        <div className="mb-7 p-4 sm:p-5">
          <div className="flex w-full flex-row flex-wrap items-end justify-between gap-3">
            <span className="text-sm font-medium text-[#47597A]">
              Filter by region
            </span>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">All Regions</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {featuredEvents.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-5 font-display text-2xl font-semibold uppercase tracking-[0.06em] text-[#1A2B49]">
              Featured Events
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        <section>
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : pageEvents.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center">
              <h3 className="text-lg font-semibold text-[#1A2B49]">No Events Found</h3>
              <p className="mt-1 text-sm text-[#6A7898]">
                No events available for the selected region.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pageEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-[#D0D8E6] px-4 py-2 text-sm text-[#4A5D7E] disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-9 w-9 rounded-md text-sm font-semibold ${
                        page === currentPage
                          ? "bg-[#0078C0] text-white"
                          : "text-[#4A5D7E] hover:bg-[#E7EEF7]"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-[#D0D8E6] px-4 py-2 text-sm text-[#4A5D7E] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
