import { SectionHeading } from "@/components/atoms/section-heading";
import { EventCard } from "@/components/atoms/event-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { EventsSkeleton } from "@/components/ui/Skeleton";
import { eventsApi } from "@/lib/api-client";

export async function EventsSection() {
  let events;
  try {
    const res = await eventsApi.upcoming({ limit: 3 });
    events = res.data;
  } catch {
    return <EventsSkeleton />;
  }

  if (!events || events.length === 0) return <EventsSkeleton />;

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="EVENTS AND FESTIVALS" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              image={event.cover_image || ""}
              title={event.title}
              href={`/events/${event.slug}`}
            />
          ))}
        </div>

        <ViewMoreButton href="/events" />
      </div>
    </section>
  );
}
