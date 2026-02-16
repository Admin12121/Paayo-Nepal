import { NextRequest } from "next/server";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";

// Suppress unhandled ResponseAborted rejections caused by SSE client disconnects.
// These are normal in dev (browser navigates away, hot-reload, etc.) and harmless.
if (
  typeof process !== "undefined" &&
  !(process as any).__sseAbortHandlerInstalled
) {
  (process as any).__sseAbortHandlerInstalled = true;
  process.on("unhandledRejection", (reason: unknown) => {
    if (
      reason &&
      typeof reason === "object" &&
      "name" in reason &&
      (reason as any).name === "ResponseAborted"
    ) {
      // Silently ignore — this is expected when SSE clients disconnect
      return;
    }
    // Re-log anything that isn't a ResponseAborted so real errors aren't hidden
    console.error("unhandledRejection:", reason);
  });
}

// ---------------------------------------------------------------------------
// Dedicated SSE streaming route for real-time notifications.
//
// ## Production (nginx)
//
//   In production, nginx routes `/api/notifications/stream` directly to the
//   Rust backend. The browser sends the `paayo_session` cookie (set by
//   `/api/auth/sync-session`) and Rust authenticates the user directly.
//   This Next.js route is NOT hit in production at all.
//
// ## Development (no nginx)
//
//   In development, there's no nginx. The frontend dev server handles
//   everything. Client-side requests to `/api/notifications/stream` hit
//   this route, which proxies the SSE connection to the Rust backend.
//
//   This route:
//   1. Authenticates via BetterAuth (extracts the raw session token)
//   2. Opens an SSE connection to the Rust backend
//   3. Pipes the stream back to the client in real-time
//
// ## Why this file still exists
//
//   Even though nginx handles this in production, we keep this route for:
//   - Local development without Docker/nginx
//   - Fallback if nginx is misconfigured
//   - Testing SSE functionality without the full stack
//
// ---------------------------------------------------------------------------

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.INTERNAL_API_URL ||
  "http://backend:8080/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // -----------------------------------------------------------------------
  // 1. Authenticate — extract the raw session token from better-auth
  // -----------------------------------------------------------------------
  let rawSessionToken: string | undefined;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session?.session?.token) {
      rawSessionToken = session.session.token;
    }
  } catch {
    // No valid session
  }

  if (!rawSessionToken) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // -----------------------------------------------------------------------
  // 2. Connect to the backend SSE endpoint
  //
  //    We set the `paayo_session` cookie (preferred) AND the legacy
  //    `better-auth.session_token` cookie so the Rust backend can
  //    authenticate regardless of which cookie name it checks first.
  // -----------------------------------------------------------------------
  const backendUrl = `${BACKEND_API_URL}/notifications/stream`;

  const fetchHeaders = new Headers();
  fetchHeaders.set(
    "Cookie",
    `paayo_session=${rawSessionToken}; better-auth.session_token=${rawSessionToken}`,
  );
  fetchHeaders.set("Accept", "text/event-stream");
  fetchHeaders.set("Cache-Control", "no-cache");

  // Forward the accept-encoding header if present so the backend can decide
  // whether to compress. (SSE usually shouldn't be compressed, but let the
  // backend decide.)
  const acceptEncoding = req.headers.get("accept-encoding");
  if (acceptEncoding) {
    fetchHeaders.set("Accept-Encoding", acceptEncoding);
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers: fetchHeaders,
      signal: req.signal,
      // Prevent Next.js / Node from buffering the response
      cache: "no-store",
    });
  } catch (error) {
    console.error("[SSE proxy] Failed to connect to backend:", error);
    return new Response(
      JSON.stringify({ error: "Backend service unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!backendResponse.ok) {
    const text = await backendResponse.text().catch(() => "");
    return new Response(text || "Backend error", {
      status: backendResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!backendResponse.body) {
    return new Response(
      JSON.stringify({ error: "No stream body from backend" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  // -----------------------------------------------------------------------
  // 3. Pipe the backend ReadableStream back to the client
  //
  // We create a TransformStream so we can relay bytes 1:1. If the client
  // disconnects (AbortSignal fires), the readable side cancels which
  // propagates back to the backend fetch, closing both ends cleanly.
  // -----------------------------------------------------------------------
  const { readable, writable } = new TransformStream();
  const reader = backendResponse.body.getReader();
  const writer = writable.getWriter();

  // Track whether writer has already been closed to avoid double-close
  let writerClosed = false;

  const safeCloseWriter = async () => {
    if (writerClosed) return;
    writerClosed = true;
    try {
      await writer.close();
    } catch {
      // Already closed or errored — safe to ignore
    }
  };

  const safeCancelReader = async () => {
    try {
      await reader.cancel();
    } catch {
      // Already cancelled — safe to ignore
    }
  };

  // Listen for client abort so we can tear down proactively
  const abortHandler = () => {
    safeCancelReader();
    safeCloseWriter();
  };
  req.signal.addEventListener("abort", abortHandler, { once: true });

  // Run the relay in the background — don't await it
  (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // Check if the client already disconnected before writing
        if (req.signal.aborted) break;
        await writer.write(value);
      }
    } catch {
      // Client disconnected or backend stream ended — both are normal for SSE
    } finally {
      req.signal.removeEventListener("abort", abortHandler);
      await safeCloseWriter();
      await safeCancelReader();
    }
  })();

  // -----------------------------------------------------------------------
  // 4. Return SSE response headers
  // -----------------------------------------------------------------------
  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Tell nginx not to buffer this response
    },
  });
}
