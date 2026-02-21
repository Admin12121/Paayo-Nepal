import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

function resolveBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

const authClient = createAuthClient({
  baseURL: resolveBaseUrl(),
  plugins: [twoFactorClient(), passkeyClient()],
  sessionOptions: {
    // Avoid background re-fetches on tab focus; explicit auth actions and
    // route-level server checks are enough for this app.
    refetchOnWindowFocus: false,
    refetchInterval: 0,
  },
});

export const { signIn, signUp, signOut, useSession, twoFactor, passkey } =
  authClient;

// ---------------------------------------------------------------------------
// Session sync helper
//
// After login/signup, BetterAuth sets a SIGNED cookie that only Next.js can
// decode. The Rust backend needs a plain (unsigned) cookie with the raw
// session token. This function calls `/api/auth/sync-session` which reads
// the BetterAuth session and sets a `paayo_session` HttpOnly cookie that
// Rust can read directly.
//
// This eliminates the old double-hop architecture where every API request
// went Browser → Next.js proxy → Rust. Now with nginx routing /api/* to
// Rust directly, the browser sends the `paayo_session` cookie straight to
// Rust.
// ---------------------------------------------------------------------------

async function syncSessionCookie(): Promise<void> {
  try {
    const res = await fetch("/api/auth/sync-session", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      console.warn("[auth-client] Session sync returned", res.status);
    }
  } catch (err) {
    console.warn("[auth-client] Failed to sync session cookie:", err);
  }
}

async function clearSessionCookie(): Promise<void> {
  try {
    // Calling sync-session when no BetterAuth session exists will
    // automatically delete the paayo_session cookie.
    await fetch("/api/auth/sync-session", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort — if it fails the cookie will expire naturally
  }
}

// ---------------------------------------------------------------------------
// Wrapped auth functions that sync the raw cookie after auth state changes
// ---------------------------------------------------------------------------

export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await signIn.email({
      email,
      password,
    });

    // If sign-in succeeded (no error), sync the raw session cookie
    if (result && !result.error) {
      await syncSessionCookie();
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sign-in request failed";
    console.error("[auth-client] signIn.email failed:", error);
    return {
      data: null,
      error: { message },
    };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
) {
  const result = await signUp.email({
    email,
    password,
    name,
  });

  // Sync after successful signup (BetterAuth auto-signs in after signup)
  if (result && !result.error) {
    await syncSessionCookie();
  }

  return result;
}

export async function signInWithSocial(provider: "google") {
  // Social sign-in redirects the browser, so the sync happens after
  // the OAuth callback. We handle this via the ensureSessionSynced()
  // function which should be called on app load / page navigation.
  const baseURL = resolveBaseUrl();
  return signIn.social({
    provider,
    callbackURL: `${baseURL}/dashboard`,
  });
}

export async function signOutAndClear() {
  // Clear the raw session cookie first (while we still have the session)
  await clearSessionCookie();

  // Then sign out from BetterAuth (clears the signed cookie)
  return signOut();
}

// ---------------------------------------------------------------------------
// TOTP / 2FA functions
// ---------------------------------------------------------------------------

export async function enableTwoFactor(password: string) {
  return twoFactor.enable({ password });
}

export async function verifyTwoFactor(code: string) {
  const result = await twoFactor.verifyTotp({ code });

  // After successful 2FA verification, the session is fully authenticated.
  // Sync the raw cookie so Rust sees the authenticated session.
  if (result && !result.error) {
    await syncSessionCookie();
  }

  return result;
}

export async function disableTwoFactor(password: string) {
  return twoFactor.disable({ password });
}

// ---------------------------------------------------------------------------
// Passkey functions
// ---------------------------------------------------------------------------

export async function registerPasskey() {
  return passkey.addPasskey();
}

export async function signInWithPasskey() {
  const result = await signIn.passkey();

  // Sync after successful passkey sign-in
  if (result && !result.error) {
    await syncSessionCookie();
  }

  return result;
}

export async function listPasskeys() {
  return passkey.listUserPasskeys();
}

export async function deletePasskey(id: string) {
  return passkey.deletePasskey({ id });
}

// ---------------------------------------------------------------------------
// Session sync on page load
//
// Call this once on app initialization (e.g., in a top-level useEffect or
// in the StoreProvider) to ensure the raw cookie exists if the user is
// already logged in. This handles:
//   - OAuth callback redirects (social login sets BetterAuth cookie during
//     redirect, but sync-session hasn't been called yet)
//   - Page refreshes where the BetterAuth cookie is still valid but
//     paayo_session has expired or was cleared
//   - Cookie rotation (BetterAuth rotated the token)
// ---------------------------------------------------------------------------

let syncPromise: Promise<void> | null = null;

export function ensureSessionSynced(): Promise<void> {
  // Deduplicate: if a sync is already in progress, return the same promise
  if (syncPromise) return syncPromise;

  syncPromise = syncSessionCookie().finally(() => {
    // Allow re-sync after 30 seconds (matches BetterAuth's cookieCache maxAge)
    setTimeout(() => {
      syncPromise = null;
    }, 30_000);
  });

  return syncPromise;
}
