import { baseApi } from "./baseApi";
import type {
  DashboardStats,
  UserCounts,
  ViewSummaryItem,
  PaginatedResponse,
} from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Admin Stats API slice — injected into the base API
//
// Provides aggregated statistics for the admin dashboard. These endpoints
// combine data from multiple backend endpoints into a single dashboard-
// friendly shape.
//
// Most of these endpoints require admin or editor authentication. The
// backend will return 401/403 for unauthenticated or unauthorized users.
//
// Endpoints used:
//   GET /views/admin/summary           — view stats by content type (admin)
//   GET /users/counts                  — user count breakdown (admin)
//   GET /posts?limit=1                 — total post count (from pagination)
//   GET /posts?limit=1&status=published — published post count
//   GET /posts?limit=1&status=draft    — draft post count
//   GET /events?limit=1               — total event count
//   GET /events/upcoming?limit=1      — upcoming event count
//   GET /attractions?limit=1          — total attraction count
//   GET /regions?limit=1              — total region count
//   GET /media?limit=1                — total media count
//   GET /videos?limit=1               — total video count
//   GET /hotels?limit=1               — total hotel count
//   GET /photos?limit=1               — total photo feature count
//   GET /comments/moderation/pending-count — pending comment count
//
// All of these are fetched in parallel. Individual failures are caught so
// the dashboard still renders partial data.
// ---------------------------------------------------------------------------

export const adminStatsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Individual Stat Queries ──────────────────────────────────────

    /**
     * Get total views summary across all content types (admin only).
     *
     * Returns an array of `ViewSummaryItem` objects, one per content type,
     * with `target_type`, `total_views`, and `unique_viewers` fields.
     *
     * Cache tags:
     *   - { type: 'DashboardStats', id: 'VIEWS_SUMMARY' }
     */
    getViewsSummary: builder.query<ViewSummaryItem[], void>({
      query: () => "/views/admin/summary",
      providesTags: [{ type: "DashboardStats", id: "VIEWS_SUMMARY" }],
      keepUnusedDataFor: 120,
    }),

    /**
     * Get user count breakdown (admin only).
     *
     * Returns a `UserCounts` object with `total`, `active`, `pending`,
     * `blocked`, `admins`, and `editors` counts.
     *
     * Cache tags:
     *   - { type: 'DashboardStats', id: 'USER_COUNTS' }
     */
    getUserCounts: builder.query<UserCounts, void>({
      query: () => "/users/counts",
      providesTags: [
        { type: "DashboardStats", id: "USER_COUNTS" },
        { type: "User", id: "LIST" },
      ],
      keepUnusedDataFor: 60,
    }),

    // ─── Aggregated Dashboard Stats ───────────────────────────────────

    /**
     * Fetch all dashboard stats in parallel.
     *
     * This is a composite query that fetches data from 14 different
     * endpoints simultaneously and merges them into a single
     * `DashboardStats` object. Individual endpoint failures are caught
     * so the dashboard still renders with partial data.
     *
     * Cache tags:
     *   - { type: 'DashboardStats', id: 'ALL' }
     *
     * This query has a relatively short cache time (60 seconds) because
     * dashboard stats are expected to change frequently. The dashboard
     * also uses `refetchOnFocus: true` (from the base API config) so
     * stats refresh when the user returns to the dashboard tab.
     *
     * Implementation note:
     *   This uses `queryFn` instead of `query` because we need to make
     *   multiple parallel fetch calls and merge the results. The
     *   `queryFn` function has access to the `fetchWithBQ` helper which
     *   uses the same baseQuery configuration (credentials, headers,
     *   base URL) as regular endpoints.
     *
     * Usage:
     *   const { data: stats, isLoading, error } = useGetDashboardStatsQuery();
     *
     *   // stats.posts.total, stats.posts.published, stats.posts.draft, stats.posts.pending
     *   // stats.media.total
     *   // stats.events.total, stats.events.upcoming
     *   // stats.attractions.total
     *   // stats.regions.total
     *   // stats.users.total, stats.users.active, stats.users.pending, ...
     *   // stats.views — array of ViewSummaryItem
     *   // stats.totalViews, stats.totalLikes
     *   // stats.comments.pending
     *   // stats.videos.total
     *   // stats.hotels.total
     *   // stats.photos.total
     */
    getDashboardStats: builder.query<DashboardStats, void>({
      queryFn: async (_arg, _queryApi, _extraOptions, fetchWithBQ) => {
        // Default stats — used as fallback for any failed requests
        const defaults: DashboardStats = {
          posts: { total: 0, published: 0, draft: 0, pending: 0 },
          media: { total: 0 },
          events: { total: 0, upcoming: 0 },
          attractions: { total: 0 },
          regions: { total: 0 },
          users: {
            total: 0,
            active: 0,
            pending: 0,
            blocked: 0,
            admins: 0,
            editors: 0,
          },
          views: [],
          totalViews: 0,
          totalLikes: 0,
          comments: { pending: 0 },
          videos: { total: 0 },
          hotels: { total: 0 },
          photos: { total: 0 },
        };

        // Fire all requests in parallel using Promise.allSettled so that
        // individual failures don't prevent the rest from completing.
        const [
          postsAll,
          postsPublished,
          postsDraft,
          eventsAll,
          eventsUpcoming,
          attractionsAll,
          regionsAll,
          mediaAll,
          userCounts,
          viewsSummary,
          commentsPending,
          videosAll,
          hotelsAll,
          photosAll,
        ] = await Promise.allSettled([
          // Posts counts by status — fetch with limit=1 just to get total
          fetchWithBQ("/posts?limit=1"),
          fetchWithBQ("/posts?limit=1&status=published"),
          fetchWithBQ("/posts?limit=1&status=draft"),
          // Events
          fetchWithBQ("/events?limit=1"),
          fetchWithBQ("/events/upcoming?limit=1"),
          // Attractions
          fetchWithBQ("/attractions?limit=1"),
          // Regions
          fetchWithBQ("/regions?limit=1"),
          // Media
          fetchWithBQ("/media?limit=1"),
          // Users (admin)
          fetchWithBQ("/users/counts"),
          // Views (admin)
          fetchWithBQ("/views/admin/summary"),
          // Comments pending (admin)
          fetchWithBQ("/comments/moderation/pending-count"),
          // Videos
          fetchWithBQ("/videos?limit=1"),
          // Hotels
          fetchWithBQ("/hotels?limit=1"),
          // Photo Features
          fetchWithBQ("/photos?limit=1"),
        ]);

        // Helper to safely extract data from a settled promise result.
        // The fetchWithBQ result is { data, error } — we only want the
        // data if the promise fulfilled AND there's no error in the result.
        function extract<T>(result: PromiseSettledResult<unknown>): T | null {
          if (result.status !== "fulfilled") return null;
          const val = result.value as { data?: T; error?: unknown };
          if (val.error) return null;
          return val.data ?? null;
        }

        // Helper to get .total from a paginated response
        function paginatedTotal(result: PromiseSettledResult<unknown>): number {
          const data = extract<PaginatedResponse<unknown>>(result);
          return data?.total ?? 0;
        }

        // ── Posts ──
        defaults.posts.total = paginatedTotal(postsAll);
        defaults.posts.published = paginatedTotal(postsPublished);
        defaults.posts.draft = paginatedTotal(postsDraft);
        defaults.posts.pending = Math.max(
          0,
          defaults.posts.total -
            defaults.posts.published -
            defaults.posts.draft,
        );

        // ── Events ──
        defaults.events.total = paginatedTotal(eventsAll);
        defaults.events.upcoming = paginatedTotal(eventsUpcoming);

        // ── Attractions ──
        defaults.attractions.total = paginatedTotal(attractionsAll);

        // ── Regions ──
        defaults.regions.total = paginatedTotal(regionsAll);

        // ── Media ──
        defaults.media.total = paginatedTotal(mediaAll);

        // ── Users ──
        const userCountsData = extract<UserCounts>(userCounts);
        if (userCountsData) {
          defaults.users = userCountsData;
        }

        // ── Views ──
        const viewsSummaryData = extract<ViewSummaryItem[]>(viewsSummary);
        if (viewsSummaryData) {
          defaults.views = viewsSummaryData;
          defaults.totalViews = viewsSummaryData.reduce(
            (sum, v) => sum + v.total_views,
            0,
          );
        }

        // ── Comments ──
        const commentsPendingData = extract<{ count: number }>(commentsPending);
        if (commentsPendingData) {
          defaults.comments.pending = commentsPendingData.count;
        }

        // ── Videos ──
        defaults.videos.total = paginatedTotal(videosAll);

        // ── Hotels ──
        defaults.hotels.total = paginatedTotal(hotelsAll);

        // ── Photos ──
        defaults.photos.total = paginatedTotal(photosAll);

        return { data: defaults };
      },

      providesTags: [
        { type: "DashboardStats", id: "ALL" },
        // Also tag with individual stat types so that specific mutations
        // (e.g., creating a post) can invalidate just 'DashboardStats'
        // and this composite query will refetch.
      ],
      keepUnusedDataFor: 60,
    }),
  }),

  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks
//
// Usage:
//   import {
//     useGetDashboardStatsQuery,
//     useGetViewsSummaryQuery,
//     useGetUserCountsQuery,
//   } from "@/lib/store/api/adminStatsApi";
//
//   // ── Full dashboard stats (composite) ──
//   // Fetches all stats in parallel and returns a single DashboardStats object.
//   // This is the primary hook used by the dashboard page.
//   //
//   //   const { data: stats, isLoading, error, refetch } =
//   //     useGetDashboardStatsQuery();
//   //
//   //   if (isLoading) return <LoadingSpinner />;
//   //
//   //   // Access individual stat groups:
//   //   console.log(`${stats.posts.total} total posts`);
//   //   console.log(`${stats.posts.published} published`);
//   //   console.log(`${stats.events.upcoming} upcoming events`);
//   //   console.log(`${stats.users.total} total users`);
//   //   console.log(`${stats.totalViews} total views across all content`);
//   //   console.log(`${stats.comments.pending} comments awaiting moderation`);
//   //
//   //   // Manual refresh (e.g., after a bulk operation):
//   //   refetch();
//
//   // ── Views summary only (admin) ──
//   // Use this if you only need the views breakdown table without the
//   // full dashboard stats overhead.
//   //
//   //   const { data: views } = useGetViewsSummaryQuery();
//   //   views?.forEach((item) => {
//   //     console.log(`${item.target_type}: ${item.total_views} views`);
//   //   });
//
//   // ── User counts only (admin) ──
//   // Use this if you only need user statistics (e.g., for a user
//   // management page header).
//   //
//   //   const { data: users } = useGetUserCountsQuery();
//   //   console.log(`${users?.total} total users, ${users?.active} active`);
//
// ---------------------------------------------------------------------------
// Cache invalidation
//
// The `DashboardStats` tag type is automatically invalidated by mutations
// in other API slices (posts, events, media, etc.) — look for
// `{ type: "DashboardStats" }` in their `invalidatesTags` arrays.
//
// This means that after creating, updating, or deleting content, the
// dashboard stats will automatically refetch the next time the user
// views the dashboard. Combined with `refetchOnFocus: true`, this
// ensures stats are always reasonably fresh without manual refresh.
//
// For immediate refresh (e.g., after a bulk import), you can manually
// invalidate the stats:
//
//   import { baseApi } from "@/lib/store/api/baseApi";
//
//   dispatch(
//     baseApi.util.invalidateTags([{ type: "DashboardStats", id: "ALL" }]),
//   );
// ---------------------------------------------------------------------------

export const {
  useGetDashboardStatsQuery,
  useGetViewsSummaryQuery,
  useGetUserCountsQuery,
} = adminStatsApi;
