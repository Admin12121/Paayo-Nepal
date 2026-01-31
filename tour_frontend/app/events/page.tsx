"use client";

import { useState, useEffect } from "react";
import { Calendar, MapPin, Clock } from "lucide-react";
import { eventsApi, Event, regionsApi, Region } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";

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

// Event Card Component
function EventCard({ event }: { event: Event }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link href={`/events/${event.slug}`}>
      <div
        className="bg-white rounded-[20px] overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl"
        style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
      >
        <div className="overflow-hidden rounded-[16px] h-[320px] relative">
          {event.featured_image ? (
            <Image
              src={event.featured_image}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              placeholder={event.featured_image_blur ? "blur" : "empty"}
              blurDataURL={event.featured_image_blur || undefined}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-gray-400" />
            </div>
          )}
          {event.is_featured && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-[#F29C72] text-white text-xs font-semibold rounded-full">
              Featured
            </div>
          )}
        </div>
        <div className="p-6">
          <h3 className="font-display text-2xl font-semibold text-[#1A2B49] mb-3 line-clamp-2">
            {event.title}
          </h3>
          {event.description && (
            <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-2">
              {event.description}
            </p>
          )}
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0078C0]" />
              <span>
                {formatDate(event.start_date)}
                {event.end_date && ` - ${formatDate(event.end_date)}`}
              </span>
            </div>
            {event.start_time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0078C0]" />
                <span>
                  {event.start_time}
                  {event.end_time && ` - ${event.end_time}`}
                </span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0078C0]" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Event Card Skeleton
function EventCardSkeleton() {
  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden animate-pulse"
      style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
    >
      <div className="h-[320px] bg-gray-200"></div>
      <div className="p-6">
        <div className="h-7 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 12;

  useEffect(() => {
    fetchRegions();
    fetchFeaturedEvents();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [currentPage, selectedRegion]);

  const fetchRegions = async () => {
    try {
      const response = await regionsApi.list({ limit: 100 });
      setRegions(response.data);
    } catch (err) {
      console.error("Failed to fetch regions:", err);
    }
  };

  const fetchFeaturedEvents = async () => {
    try {
      const response = await eventsApi.list({ featured: true, limit: 3 });
      setFeaturedEvents(response.data);
    } catch (err) {
      console.error("Failed to fetch featured events:", err);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: currentPage,
        limit,
      };

      if (selectedRegion !== "all") {
        params.region_id = selectedRegion;
      }

      const response = await eventsApi.upcoming(params);
      setEvents(response.data);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      console.error("Failed to load events:", err);
      setEvents([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId);
    setCurrentPage(1);
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Events" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Events in Nepal
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Discover upcoming festivals, cultural celebrations, and special
            events happening across Nepal.
          </p>
        </div>

        {/* Featured Events */}
        {featuredEvents.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-6">
              Featured Events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* Region Filter */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Filter by region:
            </span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleRegionChange("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedRegion === "all"
                    ? "bg-[#0078C0] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All Regions
              </button>
              {regions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => handleRegionChange(region.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedRegion === region.id
                      ? "bg-[#0078C0] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* All Events Section */}
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-[#1A2B49] mb-6">
            {selectedRegion === "all"
              ? "All Upcoming Events"
              : `Events in ${regions.find((r) => r.id === selectedRegion)?.name}`}
          </h2>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Events Found
            </h3>
            <p className="text-gray-600">
              {selectedRegion !== "all"
                ? "No upcoming events in this region at the moment"
                : "No upcoming events available at the moment"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                        page === currentPage
                          ? "bg-[#0078C0] text-white"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
