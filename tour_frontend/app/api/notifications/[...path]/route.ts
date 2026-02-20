import { NextRequest } from "next/server";

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.INTERNAL_API_URL ||
  "http://backend:8080/api";

const BLOCKED_SEGMENTS = new Set([".", ".."]);
const FORWARDED_HEADER_DENYLIST = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "via",
  "cf-connecting-ip",
];

function normalizePathSegments(path: string[]): string[] {
  return path.map((segment) => {
    const value = segment.trim();
    if (!value || BLOCKED_SEGMENTS.has(value)) {
      throw new Error("Invalid path segment");
    }
    return encodeURIComponent(value);
  });
}

function buildBackendUrl(req: NextRequest, path: string[]) {
  const base = BACKEND_API_URL.replace(/\/+$/, "");
  const safePath = normalizePathSegments(path);
  const suffix = safePath.length > 0 ? `/${safePath.join("/")}` : "";
  return `${base}/notifications${suffix}${req.nextUrl.search}`;
}

async function proxyToBackend(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  const method = req.method.toUpperCase();
  let upstreamUrl = "";
  try {
    upstreamUrl = buildBackendUrl(req, resolvedParams.path || []);
  } catch {
    return Response.json(
      { code: "INVALID_PATH", message: "Invalid notifications path" },
      { status: 400 },
    );
  }

  const headers = new Headers(req.headers);

  // Don't forward proxy hop headers or user-supplied forwarding headers.
  for (const headerName of FORWARDED_HEADER_DENYLIST) {
    headers.delete(headerName);
  }

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await req.arrayBuffer();
    init.body = body.byteLength > 0 ? body : undefined;
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach backend";
    return Response.json(
      { code: "BACKEND_UNAVAILABLE", message },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
