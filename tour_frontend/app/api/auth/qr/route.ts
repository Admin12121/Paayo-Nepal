import { NextRequest } from "next/server";

const QR_SIZE = "220x220";
const MAX_DATA_LENGTH = 4096;

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get("data");

  if (!data) {
    return new Response("Missing data query parameter", { status: 400 });
  }

  if (data.length > MAX_DATA_LENGTH) {
    return new Response("QR payload is too large", { status: 400 });
  }

  const upstreamUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}&data=${encodeURIComponent(data)}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, { cache: "no-store" });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      return new Response("Failed to generate QR code", { status: 502 });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstreamResponse.headers.get("Content-Type") || "image/png",
    );
    headers.set("Cache-Control", "no-store");

    return new Response(upstreamResponse.body, {
      status: 200,
      headers,
    });
  } catch {
    return new Response("Failed to generate QR code", { status: 502 });
  }
}
