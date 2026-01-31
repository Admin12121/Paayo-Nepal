import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";

const BACKEND_URL = process.env.INTERNAL_API_URL || "http://backend:8080/api";

// Headers that should not be forwarded to the backend
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "host",
  "cookie", // We set our own cookie with the raw token
]);

async function proxyToBackend(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "");
  const backendUrl = `${BACKEND_URL}${path}${url.search}`;

  // Extract the raw session token from better-auth's signed cookie
  let rawSessionToken: string | undefined;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session?.session?.token) {
      rawSessionToken = session.session.token;
    }
  } catch {
    // No valid session — proceed without auth
  }

  // Forward relevant request headers
  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  // Set the raw session token as the cookie the Rust backend expects
  if (rawSessionToken) {
    forwardHeaders.set(
      "Cookie",
      `better-auth.session_token=${rawSessionToken}`,
    );
  }

  // Forward the request body for non-GET/HEAD methods
  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const backendResponse = await fetch(backendUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    // Build response headers
    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await backendResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Backend proxy error:", error);
    return NextResponse.json(
      { error: "Backend service unavailable" },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxyToBackend(req);
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req);
}

export async function PUT(req: NextRequest) {
  return proxyToBackend(req);
}

export async function DELETE(req: NextRequest) {
  return proxyToBackend(req);
}

export async function PATCH(req: NextRequest) {
  return proxyToBackend(req);
}
