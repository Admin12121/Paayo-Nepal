"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Calendar, MapPin, Eye } from "lucide-react";
import { eventsApi, Event } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/utils/toast";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    event: Event | null;
  }>({
    open: false,
    event: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [currentPage, timeFilter]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit: 20 };

      if (timeFilter === "past") {
        params.past = true;
      }

      const response =
        timeFilter === "upcoming"
          ? await eventsApi.upcoming(params)
          : await eventsApi.list(params);

      setEvents(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error("Failed to load events");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.event) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/events/${deleteDialog.event.slug}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete event");
      toast.success("Event deleted successfully");
      setDeleteDialog({ open: false, event: null });
      loadEvents();
    } catch (error) {
      toast.error("Failed to delete event");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredEvents = events.filter((event) =>
    searchQuery
      ? event.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const isUpcoming = (event: Event) => {
    return new Date(event.start_date) >= new Date();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4">
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
            onChange={(e) => setTimeFilter(e.target.value)}
            options={[
              { value: "all", label: "All Events" },
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ]}
            className="min-w-[150px]"
          />
        </div>

        {loading ? (
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
                    {event.featured_image && (
                      <img
                        src={event.featured_image}
                        alt={event.title}
                        className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {event.title}
                          </h3>
                          {event.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(event.start_date)}
                              {event.end_date &&
                                ` - ${formatDate(event.end_date)}`}
                            </div>
                            {event.location && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {event.location}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {event.views} views
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
                        <div className="flex items-center gap-2 flex-shrink-0">
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
      </div>

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
