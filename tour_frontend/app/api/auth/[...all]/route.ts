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

function sanitizeAuthResponse(response: Response): Response {
  const headers = new Headers(response.headers);

  // nginx rejects upstream responses that include both headers.
  // Keep transfer-encoding and drop content-length for streamed responses.
  if (headers.has("content-length") && headers.has("transfer-encoding")) {
    headers.delete("content-length");
    return new Response(response.body, {
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
  return sanitizeAuthResponse(response);
}

export async function POST(request: Request) {
  const response = await upstreamPOST(request);
  await logAuthServerError("POST", request, response);
  return sanitizeAuthResponse(response);
}
