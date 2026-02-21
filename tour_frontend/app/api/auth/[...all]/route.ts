import { auth } from "@/lib/auth-server";
import { toNextJsHandler } from "better-auth/next-js";

const { GET: upstreamGET, POST: upstreamPOST } = toNextJsHandler(auth);

async function logAuthServerError(
  method: "GET" | "POST",
  request: Request,
  response: Response,
) {
  if (response.status < 500) return;

  try {
    const body = await response.clone().text();
    console.error(
      `[auth-route] ${method} ${new URL(request.url).pathname} -> ${response.status}`,
      body.slice(0, 500),
    );
  } catch (error) {
    console.error(
      `[auth-route] ${method} ${new URL(request.url).pathname} -> ${response.status} (failed to read error body)`,
      error,
    );
  }
}

function hasNoBodyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}

async function sanitizeAuthResponse(
  response: Response,
  method: "GET" | "POST",
): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.delete("connection");
  headers.delete("keep-alive");
  headers.delete("proxy-authenticate");
  headers.delete("proxy-authorization");
  headers.delete("te");
  headers.delete("trailer");
  headers.delete("upgrade");

  // nginx rejects upstream responses that include both headers.
  // Drop content-length; we'll rebuild the response below.
  if (headers.has("content-length") && headers.has("transfer-encoding")) {
    headers.delete("content-length");
  }

  // Auth endpoints are not streaming. Buffering the payload avoids dangling
  // chunked responses through reverse proxies in dev/prod.
  if (method === "POST" || method === "GET") {
    if (hasNoBodyStatus(response.status)) {
      headers.delete("content-length");
      headers.delete("transfer-encoding");
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const body = await response.arrayBuffer();
    headers.delete("transfer-encoding");
    return new Response(body.byteLength > 0 ? body : null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}

export async function GET(request: Request) {
  const response = await upstreamGET(request);
  await logAuthServerError("GET", request, response);
  return sanitizeAuthResponse(response, "GET");
}

export async function POST(request: Request) {
  const response = await upstreamPOST(request);
  await logAuthServerError("POST", request, response);
  return sanitizeAuthResponse(response, "POST");
}
