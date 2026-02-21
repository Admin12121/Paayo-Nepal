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

const RESPONSE_HEADER_DENYLIST = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
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

function hasNoBodyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}

function isSseResponse(headers: Headers, pathSegments: string[]): boolean {
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return true;
  }

  return pathSegments[pathSegments.length - 1] === "stream";
}

function sanitizeResponseHeaders(headers: Headers): Headers {
  const responseHeaders = new Headers(headers);

  for (const headerName of RESPONSE_HEADER_DENYLIST) {
    responseHeaders.delete(headerName);
  }

  if (
    responseHeaders.has("content-length") &&
    responseHeaders.has("transfer-encoding")
  ) {
    responseHeaders.delete("content-length");
  }

  return responseHeaders;
}

async function buildProxyResponse(
  upstream: Response,
  method: string,
  pathSegments: string[],
) {
  const responseHeaders = sanitizeResponseHeaders(upstream.headers);

  // Keep stream bodies untouched for SSE.
  if (isSseResponse(responseHeaders, pathSegments)) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  }

  const shouldHaveBody = method !== "HEAD" && !hasNoBodyStatus(upstream.status);
  if (!shouldHaveBody) {
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  }

  const body = await upstream.arrayBuffer();
  responseHeaders.delete("transfer-encoding");

  return new Response(body.byteLength > 0 ? body : null, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function proxyNotificationsRequest(
  req: NextRequest,
  pathSegments: string[],
) {
  const method = req.method.toUpperCase();
  let upstreamUrl = "";

  try {
    upstreamUrl = buildBackendUrl(req, pathSegments);
  } catch {
    return Response.json(
      { code: "INVALID_PATH", message: "Invalid notifications path" },
      { status: 400 },
    );
  }

  const headers = new Headers(req.headers);
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
    return buildProxyResponse(upstream, method, pathSegments);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach backend";
    return Response.json(
      { code: "BACKEND_UNAVAILABLE", message },
      { status: 502 },
    );
  }
}
