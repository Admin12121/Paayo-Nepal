import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// POST /api/auth/sync-session
//
// Bridges BetterAuth (Next.js) and the Rust backend by setting an additional
// plain (unsigned) HttpOnly cookie containing the raw session token.
//
// Why this exists:
//   BetterAuth stores sessions in a SIGNED cookie that only Next.js can
//   decode. The Rust backend needs the raw token to look up the session in
//   the database. Previously, a Next.js catch-all proxy extracted the raw
//   token and forwarded it — creating a double-hop on every API request.
//
//   With nginx routing /api/* directly to Rust, the browser talks to Rust
//   without Next.js in the middle. This route sets a `paayo_session` cookie
//   with the raw token so Rust can read it directly from the browser's
//   request.
//
// When to call:
//   - After successful login  (signIn.email, signIn.social, etc.)
//   - After successful signup (signUp.email)
//   - After 2FA verification  (twoFactor.verifyTotp)
//   - On page load if `paayo_session` cookie is missing but user is logged in
//
// On logout:
//   Call this endpoint — if no valid session exists, it clears the cookie.
// ---------------------------------------------------------------------------

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Cookie lifetime should match BetterAuth session expiry (7 days)
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export async function POST() {
  const cookieStore = await cookies();

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.session?.token) {
      // Valid session — set the raw token as a plain cookie
      cookieStore.set("paayo_session", session.session.token, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });

      return NextResponse.json({
        success: true,
        synced: true,
      });
    }

    // No valid session — clear the raw cookie if it exists
    cookieStore.delete("paayo_session");

    return NextResponse.json({
      success: true,
      synced: false,
      reason: "no_session",
    });
  } catch (error) {
    // Session extraction failed — clear the cookie to be safe
    try {
      cookieStore.delete("paayo_session");
    } catch {
      // Cookie deletion failed — ignore
    }

    console.error("[sync-session] Failed to sync session:", error);

    return NextResponse.json(
      {
        success: false,
        synced: false,
        reason: "session_error",
      },
      { status: 500 },
    );
  }
}

// NOTE: GET handler intentionally removed (security — V-015).
// GET would allow session sync to be triggered by <img>, <link>, or navigation
// requests from third-party pages. Only POST is safe for state-changing cookie
// operations.

// Force dynamic — must read cookies on every request
export const dynamic = "force-dynamic";
