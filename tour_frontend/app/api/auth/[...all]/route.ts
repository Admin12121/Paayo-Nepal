import { auth } from "@/lib/auth-server";
import { toNextJsHandler } from "better-auth/next-js";

const { GET: upstreamGET, POST: upstreamPOST } = toNextJsHandler(auth);

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
  return sanitizeAuthResponse(response);
}

export async function POST(request: Request) {
  const response = await upstreamPOST(request);
  return sanitizeAuthResponse(response);
}
