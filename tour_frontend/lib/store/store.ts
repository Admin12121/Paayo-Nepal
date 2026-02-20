import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "./api/baseApi";

// ---------------------------------------------------------------------------
// Redux Store — Paayo Nepal
//
// This store is client-side only. Server-side data fetching (SSR in Next.js
// server components) continues to use `lib/api-client.ts` with Next.js
// fetch caching. RTK Query handles all client-side data fetching, caching,
// and cache invalidation.
//
// Features:
//   - RTK Query for API caching, deduplication, and background refetching
//   - Tag-based cache invalidation (mutations auto-invalidate related queries)
//   - Refetch on focus / reconnect (stale-while-revalidate pattern)
//   - DevTools integration in development
// ---------------------------------------------------------------------------

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      // RTK Query reducer — manages all API cache state
      [baseApi.reducerPath]: baseApi.reducer,

      // Add additional reducers here as needed:
      // ui: uiReducer,
      // auth: authReducer,
    },

    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // RTK Query uses non-serializable data internally (promises, etc.)
        // This is expected and safe — disable the check for the API slice.
        serializableCheck: {
          ignoredActions: [
            // RTK Query internal actions
            "api/executeMutation/fulfilled",
            "api/executeMutation/pending",
            "api/executeMutation/rejected",
          ],
          ignoredPaths: ["api.mutations"],
        },
      }).concat(baseApi.middleware),

    // Enable Redux DevTools in development only
    devTools: process.env.NODE_ENV !== "production",
  });

  // Set up listeners for refetchOnFocus and refetchOnReconnect.
  // This adds event listeners for `visibilitychange` and `online` events
  // so RTK Query can automatically refetch stale data when the user
  // returns to the tab or reconnects to the network.
  setupListeners(store.dispatch);

  return store;
};

// ---------------------------------------------------------------------------
// Type exports
//
// These types are used by the typed hooks in `hooks.ts` and throughout
// the app for type-safe Redux usage.
// ---------------------------------------------------------------------------

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
