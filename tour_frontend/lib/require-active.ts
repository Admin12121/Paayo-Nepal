import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";

/**
 * Server-side guard that redirects inactive editors back to /dashboard.
 * Call this at the top of any dashboard page that requires an active account.
 */
export async function requireActive() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userRole = (session.user as Record<string, unknown>).role as string;
  if (userRole === "admin") return;

  const isActive = !!(session.user as Record<string, unknown>).isActive;
  if (!isActive) {
    redirect("/dashboard");
  }
}
