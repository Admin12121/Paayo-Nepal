import { NextRequest } from "next/server";
import { proxyNotificationsRequest } from "../proxy";

async function proxyToBackend(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return proxyNotificationsRequest(req, resolvedParams.path || []);
}

export const dynamic = "force-dynamic";

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
