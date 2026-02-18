"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Clock } from "lucide-react";
import { eventsApi, Event, regionsApi, Region } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";

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

function isUpcomingEvent(event: Event) {
  if (!event.event_date) return false;
  return new Date(event.event_date).getTime() >= new Date().setHours(0, 0, 0, 0);
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.slug}`}>
      <article className="group overflow-hidden rounded-2xl bg-white shadow-[0_8px_22px_rgba(12,36,66,0.11)] transition-shadow hover:shadow-[0_12px_30px_rgba(12,36,66,0.16)]">
        <div className="relative h-[230px] overflow-hidden">
          {event.cover_image ? (
            <Image
              src={event.cover_image}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#DCE2EE]">
              <Calendar className="h-10 w-10 text-[#97A5BF]" />
            </div>
          )}

          {event.is_featured ? (
            <span className="absolute right-3 top-3 rounded-full bg-[#F29C72] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white">
              Featured
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <h3 className="font-display line-clamp-2 text-[24px] font-semibold leading-[1.05] text-[#1A2B49]">
            {event.title}
          </h3>

          {event.short_description ? (
            <p className="mt-2 line-clamp-2 text-sm text-[#64779A]">{event.short_description}</p>
          ) : null}

          <div className="mt-3 space-y-1.5 text-xs text-[#516482]">
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#0078C0]" />
              {event.event_date ? formatDate(event.event_date) : "Date TBD"}
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

function RailEventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.slug}`} className="group flex gap-3">
      <div className="relative h-[82px] w-[122px] shrink-0 overflow-hidden rounded-lg bg-[#DDE4EF]">
        {event.cover_image ? (
          <Image src={event.cover_image} alt={event.title} fill className="object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[#7B89A2]">
          {event.event_date ? formatDate(event.event_date) : "TBD"}
        </p>
        <h4 className="line-clamp-2 text-sm font-semibold text-[#1A2B49] transition-colors group-hover:text-[#0078C0]">
          {event.title}
        </h4>
      </div>
    </Link>
  );
}

function EventCardSkeleton() {
  return <div className="h-[360px] animate-pulse rounded-2xl bg-[#DDE3EE]" />;
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
        const [eventsRes, regionsRes] = await Promise.all([
          eventsApi.list({ limit: 200 }),
          regionsApi.list({ limit: 100 }),
        ]);

        const upcoming = eventsRes.data.filter(isUpcomingEvent);
        setAllEvents(upcoming);
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

  const latestRail = useMemo(
    () => [...allEvents].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8),
    [allEvents],
  );

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

        <div className="mb-7 rounded-2xl bg-white p-5 shadow-[0_5px_20px_rgba(14,35,63,0.08)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#47597A]">Filter by region</span>
            <button
              onClick={() => {
                setSelectedRegion("all");
                setCurrentPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${
                selectedRegion === "all"
                  ? "bg-[#0078C0] text-white"
                  : "bg-[#ECF1F8] text-[#4E6284] hover:bg-[#DFE7F2]"
              }`}
            >
              All
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => {
                  setSelectedRegion(region.id);
                  setCurrentPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${
                  selectedRegion === region.id
                    ? "bg-[#0078C0] text-white"
                    : "bg-[#ECF1F8] text-[#4E6284] hover:bg-[#DFE7F2]"
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {featuredEvents.length > 0 ? (
              <section className="mb-8">
                <h2 className="mb-4 font-display text-[24px] font-semibold tracking-[0.06em] text-[#1A2B49] uppercase">
                  Featured Events
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {featuredEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-4 font-display text-[24px] font-semibold tracking-[0.06em] text-[#1A2B49] uppercase">
                Upcoming Events
              </h2>

              {loading ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <EventCardSkeleton key={i} />
                  ))}
                </div>
              ) : pageEvents.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center">
                  <h3 className="text-lg font-semibold text-[#1A2B49]">No Events Found</h3>
                  <p className="mt-1 text-sm text-[#6A7898]">No upcoming events for this region.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
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

          <aside className="rounded-2xl bg-white p-5 shadow-[0_8px_22px_rgba(12,36,66,0.11)] h-fit">
            <h3 className="mb-4 font-display text-lg font-semibold uppercase tracking-[0.08em] text-[#1A2B49]">
              More Events
            </h3>
            <div className="space-y-4">
              {latestRail.map((event) => (
                <RailEventCard key={event.id} event={event} />
              ))}
            </div>
            <div className="mt-4 text-right">
              <Link href="/events" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#008CFF]">
                View All
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
