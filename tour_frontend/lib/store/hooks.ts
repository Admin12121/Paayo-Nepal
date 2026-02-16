import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, AppStore, RootState } from "./store";

// ---------------------------------------------------------------------------
// Typed Redux Hooks — Paayo Nepal
//
// Use these hooks throughout the app instead of the plain `useDispatch`,
// `useSelector`, and `useStore` from react-redux. They are pre-typed with
// the store's RootState and AppDispatch, so you get full type inference
// without manually annotating every call site.
//
// Usage:
//   import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
//
//   const dispatch = useAppDispatch();
//   const posts = useAppSelector((state) => state.api.queries);
// ---------------------------------------------------------------------------

/**
 * Typed version of `useDispatch` — returns `AppDispatch` so that
 * dispatching thunks and RTK Query actions is fully type-safe.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * Typed version of `useSelector` — the `state` parameter is automatically
 * typed as `RootState`, so selectors don't need manual annotations.
 */
export const useAppSelector = useSelector.withTypes<RootState>();

/**
 * Typed version of `useStore` — returns the full `AppStore` instance.
 *
 * Rarely needed in components — prefer `useAppSelector` for reading state
 * and `useAppDispatch` for dispatching actions. This is useful when you
 * need direct store access (e.g., in middleware or initialization logic).
 */
export const useAppStore = useStore.withTypes<AppStore>();
