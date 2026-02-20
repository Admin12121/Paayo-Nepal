"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/animated-link";
import Image from "next/image";
import { Plus, Edit, Trash2, Calendar, GripVertical } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Post } from "@/lib/api-client";
import {
  useListEventsQuery,
  useListUpcomingEventsQuery,
  useDeletePostMutation,
  useUpdatePostDisplayOrderMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/utils/toast";

const EMPTY_EVENTS: Post[] = [];

function DraggableEventRow({
  event,
  rankEnabled,
  formatDate,
  isUpcoming,
  onDelete,
}: {
  event: Post;
  rankEnabled: boolean;
  formatDate: (dateStr: string | null | undefined) => string;
  isUpcoming: (event: Post) => boolean;
  onDelete: (event: Post) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: event.id,
    disabled: !rankEnabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-70" : undefined}
    >
      <TableCell className="max-w-[360px] lg:max-w-[520px]">
        <div className="flex items-center gap-3">
          {rankEnabled && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab text-slate-400 active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 shrink-0" />
            </button>
          )}
          {event.cover_image && (
            <Image
              src={event.cover_image}
              alt={event.title}
              width={48}
              height={48}
              className="h-12 w-12 rounded object-cover"
              unoptimized={event.cover_image.startsWith("/uploads")}
            />
          )}
          <div className="min-w-0">
            <Link
              href={`/dashboard/events/${event.slug}/edit`}
              className="block truncate text-sm text-blue-600 hover:underline"
              title={event.title}
            >
              {event.title}
            </Link>
            <p className="truncate text-xs text-slate-500">/{event.slug}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-slate-600">
        {formatDate(event.start_time || event.event_date)}
      </TableCell>
      <TableCell>
        <Badge
          variant={isUpcoming(event) ? "default" : "outline"}
          className="capitalize"
        >
          {isUpcoming(event) ? "upcoming" : "past"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <NumberTicker
          value={event.likes ?? event.like_count ?? 0}
          className="tracking-normal text-current dark:text-current"
        />
      </TableCell>
      <TableCell className="text-slate-600">
        {formatDate(event.created_at)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/dashboard/events/${event.slug}/edit`}>
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => onDelete(event)}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function EventsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [rankingMode, setRankingMode] = useState(false);
  const [orderedEvents, setOrderedEvents] = useState<Post[]>([]);
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
    {
      skip: timeFilter === "upcoming",
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  const upcomingEventsQuery = useListUpcomingEventsQuery(
    {
      page: currentPage,
      limit: 20,
    },
    {
      skip: timeFilter !== "upcoming",
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  // Pick the active query result based on the filter
  const activeQuery =
    timeFilter === "upcoming" ? upcomingEventsQuery : allEventsQuery;

  const { data: eventsResponse, isLoading, isFetching } = activeQuery;

  const [deleteEvent, { isLoading: deleting }] = useDeletePostMutation();
  const [updatePostDisplayOrder, { isLoading: savingOrder }] =
    useUpdatePostDisplayOrderMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const events = eventsResponse?.data ?? EMPTY_EVENTS;
  const totalPages = eventsResponse?.total_pages ?? 1;

  useEffect(() => {
    setOrderedEvents(events);
  }, [events]);

  // Client-side search filter (instant, no network request)
  const filteredEvents = orderedEvents.filter((event) =>
    searchQuery
      ? event.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );
  const canRankEvents = searchQuery.trim() === "";
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );
  const dataIds = useMemo<UniqueIdentifier[]>(
    () => filteredEvents.map((event) => event.id),
    [filteredEvents],
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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!rankingMode || !canRankEvents || !over || active.id === over.id)
      return;
    setOrderedEvents((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    if (!canRankEvents) {
      toast.error("Clear search to reorder.");
      return;
    }
    try {
      const base = (currentPage - 1) * 20;
      const changed = orderedEvents
        .map((event, index) => ({ event, index }))
        .filter(({ event, index }) => events[index]?.id !== event.id);
      if (changed.length === 0) {
        toast.info("No order changes to save");
        return;
      }
      await Promise.all(
        changed.map(({ event, index }) =>
          updatePostDisplayOrder({
            id: event.id,
            display_order: base + index,
          }).unwrap(),
        ),
      );
      toast.success("Event order updated");
    } catch (error) {
      toast.error("Failed to update order");
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

      <div className="mb-6">
        <div className="p-4 sm:p-5 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[300px]"
          />
          <div className="flex flex-row gap-3 ">
            <Select
              value={timeFilter}
              onValueChange={(value) => {
                setTimeFilter(value);
                setCurrentPage(1);
                setRankingMode(false);
              }}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={rankingMode ? "default" : "outline"}
              size="sm"
              disabled={!canRankEvents}
              onClick={() => setRankingMode((prev) => !prev)}
            >
              Rank Mode
            </Button>
            {rankingMode && (
              <Button
                size="sm"
                onClick={handleSaveOrder}
                isLoading={savingOrder}
              >
                Save Order
              </Button>
            )}
          </div>
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
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                sensors={sensors}
                onDragEnd={handleDragEnd}
              >
                <Table className="table-fixed">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[44%]">Title</TableHead>
                      <TableHead className="w-[18%]">Schedule</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[8%] text-right">Likes</TableHead>
                      <TableHead className="w-[12%]">Date</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={dataIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredEvents.map((event) => (
                        <DraggableEventRow
                          key={event.id}
                          event={event}
                          rankEnabled={rankingMode && canRankEvents}
                          formatDate={formatDate}
                          isUpcoming={isUpcoming}
                          onDelete={(item) =>
                            setDeleteDialog({ open: true, event: item })
                          }
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
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
