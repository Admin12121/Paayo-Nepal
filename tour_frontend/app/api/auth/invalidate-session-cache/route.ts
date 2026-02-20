import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * POST /api/auth/invalidate-session-cache
 *
 * Clears the better-auth session data cache cookie so that the next call to
 * `auth.api.getSession()` reads fresh data from the database instead of
 * returning the stale cached value.
 *
 * This is called by the frontend when an editor receives a "verified" SSE
 * notification (meaning an admin just activated/deactivated their account).
 * Without this, the `cookieCache` (maxAge: 5 min) would serve stale
 * `isActive` values until the cache naturally expires.
 *
 * The cookie name follows better-auth's convention:
 *   `${cookiePrefix}.session_data`
 * Our prefix is "better-auth", so the cookie is "better-auth.session_data".
 */
export async function POST() {
  const cookieStore = await cookies();

  // Delete the session data cache cookie.
  // better-auth stores cached session JSON in this cookie.
  // The exact name depends on the `advanced.cookiePrefix` setting in auth config.
  const cacheNames = [
    "better-auth.session_data",
    "better-auth.session-data",
    "__session-data",
  ];

  for (const name of cacheNames) {
    try {
      cookieStore.delete(name);
    } catch {
      // Cookie might not exist — that's fine
    }
  }

  return NextResponse.json({ success: true, cleared: cacheNames });
}
