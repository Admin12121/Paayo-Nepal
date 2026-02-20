import { SectionHeading } from "@/components/atoms/section-heading";
import { EventCard } from "@/components/atoms/event-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { eventsApi } from "@/lib/api-client";

export async function EventsSection() {
  let events: Awaited<ReturnType<typeof eventsApi.list>>["data"] = [];
  try {
    const res = await eventsApi.upcoming({ limit: 4 });
    events = res.data;

    // Fallback for instances where event_date is not configured yet.
    if (events.length === 0) {
      const featured = await eventsApi.list({ limit: 4, featured: true });
      events = featured.data;
    }

    // Final fallback: latest published events.
    if (events.length === 0) {
      const latest = await eventsApi.list({ limit: 4 });
      events = latest.data;
    }
  } catch {
    events = [];
  }

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="EVENTS AND FESTIVALS" />

        {events.length === 0 ? (
          <h1 className="text-sm font-medium text-[#6B7280]">
            NO content available
          </h1>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                image={event.cover_image || ""}
                title={event.title}
                href={`/events/${event.slug}`}
              />
            ))}
          </div>
        )}

        <ViewMoreButton href="/events" />
      </div>
    </section>
  );
}
