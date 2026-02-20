import { baseApi, buildQueryString } from "./baseApi";
import type {
  Post,
  PaginatedResponse,
} from "@/lib/api-client";
import { enrichPost, enrichPaginated, type PostRaw } from "./postsApi";

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface ListEventsParams {
  page?: number;
  limit?: number;
  region_id?: string;
  featured?: boolean;
}

export interface UpcomingEventsParams {
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Events API slice — injected into the base API
//
// Events are stored in the `posts` table with `type = 'event'`.
// The backend exposes them under `/events` with dedicated endpoints.
// The enrichment layer maps `event_date → start_time`,
// `event_end_date → end_time`, and flattens JSONB `content` fields
// like `location`.
// ---------------------------------------------------------------------------

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────

    /**
     * List events with optional filters.
     *
     * Cache tags:
     *   - { type: 'Event', id: 'LIST' }
     *   - { type: 'Event', id: '<slug>' } for each item
     */
    listEvents: builder.query<PaginatedResponse<Post>, ListEventsParams | void>(
      {
        query: (params) => {
          const p = params ?? {};
          return `/events${buildQueryString({
            page: p.page,
            limit: p.limit,
            region_id: p.region_id,
            featured: p.featured,
          })}`;
        },
        transformResponse: (response: PaginatedResponse<PostRaw>) =>
          enrichPaginated(response),
        providesTags: (result) => {
          if (!result?.data) {
            return [{ type: "Event", id: "LIST" }];
          }
          return [
            { type: "Event", id: "LIST" },
            ...result.data.map((item) => ({
              type: "Event" as const,
              id: item.slug || item.id,
            })),
          ];
        },
        keepUnusedDataFor: 300,
      },
    ),

    /**
     * List upcoming events (events with event_date >= now).
     *
     * Cache tags:
     *   - { type: 'Event', id: 'UPCOMING' }
     *   - { type: 'Event', id: '<slug>' } for each item
     */
    listUpcomingEvents: builder.query<
      PaginatedResponse<Post>,
      UpcomingEventsParams | void
    >({
      query: (params) => {
        const p = params ?? {};
        return `/events/upcoming${buildQueryString({
          page: p.page,
          limit: p.limit,
        })}`;
      },
      transformResponse: (response: PaginatedResponse<PostRaw>) =>
        enrichPaginated(response),
      providesTags: (result) => {
        if (!result?.data) {
          return [{ type: "Event", id: "UPCOMING" }];
        }
        return [
          { type: "Event", id: "UPCOMING" },
          ...result.data.map((item) => ({
            type: "Event" as const,
            id: item.slug || item.id,
          })),
        ];
      },
      keepUnusedDataFor: 300,
    }),

    /**
     * Get a single event by slug.
     *
     * Cache tags:
     *   - { type: 'Event', id: '<slug>' }
     */
    getEventBySlug: builder.query<Post, string>({
      query: (slug) => `/events/${slug}`,
      transformResponse: (response: PostRaw) => enrichPost(response),
      providesTags: (_result, _error, slug) => [{ type: "Event", id: slug }],
      keepUnusedDataFor: 300,
    }),

    // ─── Mutations ───────────────────────────────────────────────────
    // Events are created/updated/deleted via the Posts API (they share
    // the same table). Use `useCreatePostMutation` etc. from postsApi
    // with `post_type: 'event'`. The invalidation tags below ensure
    // event lists also refresh when posts are mutated.
    //
    // If you need event-specific mutations in the future, add them here.
  }),

  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks
//
// Usage:
//   import { useListEventsQuery, useListUpcomingEventsQuery } from "@/lib/store/api/eventsApi";
//
//   // List all events
//   const { data, isLoading } = useListEventsQuery({ page: 1, limit: 20 });
//
//   // List upcoming events for homepage
//   const { data: upcoming } = useListUpcomingEventsQuery({ limit: 6 });
//
//   // Get a single event by slug
//   const { data: event } = useGetEventBySlugQuery("dashain-festival-2025");
// ---------------------------------------------------------------------------

export const {
  useListEventsQuery,
  useListUpcomingEventsQuery,
  useGetEventBySlugQuery,
} = eventsApi;
