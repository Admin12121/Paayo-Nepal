import { NextRequest } from "next/server";
import { proxyNotificationsRequest } from "./proxy";

function proxyRoot(req: NextRequest) {
  return proxyNotificationsRequest(req, []);
}

export const dynamic = "force-dynamic";

export const GET = proxyRoot;
export const POST = proxyRoot;
export const PUT = proxyRoot;
export const PATCH = proxyRoot;
export const DELETE = proxyRoot;
