"use client";

import { useRef, useEffect } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "./store";
import { ensureSessionSynced } from "@/lib/auth-client";

// ---------------------------------------------------------------------------
// StoreProvider — Redux + RTK Query provider for client components
//
// This component:
//   1. Creates a single Redux store instance (per client-side app lifecycle)
//   2. Wraps children with the react-redux <Provider>
//   3. Syncs the raw session cookie on mount (ensures `paayo_session` cookie
//      exists if the user is already logged in via BetterAuth)
//
// Architecture notes:
//   - The store is created lazily via `useRef` so it's only instantiated once
//     per component lifecycle (not on every render).
//   - `ensureSessionSynced()` is called once on mount to handle cases where
//     the user is already authenticated (e.g., page refresh, OAuth callback
//     redirect) but the `paayo_session` cookie hasn't been set yet.
//   - Server components do NOT use this provider — they fetch data via
//     `lib/api-client.ts` using Next.js fetch caching (server-side only).
//   - This provider should be placed in the root layout so all client
//     components can access the Redux store and RTK Query cache.
//
// Usage (in app/layout.tsx or a client layout wrapper):
//
//   import { StoreProvider } from "@/lib/store/provider";
//
//   export default function Layout({ children }) {
//     return <StoreProvider>{children}</StoreProvider>;
//   }
// ---------------------------------------------------------------------------

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Create the store once per component lifecycle.
  // useRef ensures the store survives re-renders without being recreated.
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  // Sync the raw session cookie on mount.
  // This ensures that if the user is already logged in (BetterAuth session
  // cookie exists), the plain `paayo_session` cookie is set so that
  // RTK Query requests (which go directly to Rust via nginx) include
  // valid authentication.
  useEffect(() => {
    ensureSessionSynced();
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
