"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Edit, Trash2, Calendar, Eye } from "lucide-react";
import type { Post } from "@/lib/api-client";
import {
  useListEventsQuery,
  useListUpcomingEventsQuery,
  useDeletePostMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

export default function EventsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    event: Post | null;
  }>({
    open: false,
    event: null,
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // We use different queries depending on the time filter:
  //   - "all" / "past" → useListEventsQuery
  //   - "upcoming"     → useListUpcomingEventsQuery
  //
  // RTK Query automatically caches, deduplicates, and refetches as needed.

  const allEventsQuery = useListEventsQuery(
    {
      page: currentPage,
      limit: 20,
    },
    { skip: timeFilter === "upcoming" },
  );

  const upcomingEventsQuery = useListUpcomingEventsQuery(
    {
      page: currentPage,
      limit: 20,
    },
    { skip: timeFilter !== "upcoming" },
  );

  // Pick the active query result based on the filter
  const activeQuery =
    timeFilter === "upcoming" ? upcomingEventsQuery : allEventsQuery;

  const { data: eventsResponse, isLoading, isFetching } = activeQuery;

  const [deleteEvent, { isLoading: deleting }] = useDeletePostMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const events = eventsResponse?.data ?? [];
  const totalPages = eventsResponse?.total_pages ?? 1;

  // Client-side search filter (instant, no network request)
  const filteredEvents = events.filter((event) =>
    searchQuery
      ? event.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Helpers ─────────────────────────────────────────────────────────────

  const isUpcoming = (event: Post) => {
    const eventDate = event.start_time || event.event_date;
    return eventDate ? new Date(eventDate) >= new Date() : false;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.event) return;

    try {
      await deleteEvent(deleteDialog.event.slug).unwrap();
      toast.success("Event deleted successfully");
      setDeleteDialog({ open: false, event: null });
    } catch (error) {
      toast.error("Failed to delete event");
      console.error(error);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600 mt-1">
            Manage tourism events and festivals
          </p>
        </div>
        <Link href="/dashboard/events/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Button>
        </Link>
      </div>

      <DashboardCard className="mb-6" contentClassName="p-0">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Events" },
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ]}
            className="min-w-[150px]"
          />
        </div>

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No events found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {event.cover_image && (
                      <Image
                        src={event.cover_image}
                        alt={event.title}
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg shrink-0"
                        unoptimized={event.cover_image.startsWith("/uploads")}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {event.title}
                          </h3>
                          {event.short_description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {event.short_description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(event.start_time || event.event_date)}
                              {(event.end_time || event.event_end_date) &&
                                ` - ${formatDate(event.end_time || event.event_end_date)}`}
                            </div>
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {event.likes ?? event.like_count ?? 0} likes
                            </div>
                          </div>
                          <div className="mt-2">
                            {isUpcoming(event) ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Upcoming
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Past
                              </span>
                            )}
                            {event.is_featured && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Featured
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/dashboard/events/${event.slug}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, event })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </DashboardCard>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, event: null })}
        onConfirm={handleDelete}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteDialog.event?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
