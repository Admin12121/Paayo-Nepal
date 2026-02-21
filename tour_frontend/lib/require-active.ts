import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";

/**
 * Server-side guard that redirects inactive editors back to /dashboard.
 * Call this at the top of any dashboard page that requires an active account.
 */
export async function requireActive() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const userRole = session.user.role;
  if (userRole === "admin") return;

  const isActive = !!session.user.isActive;
  if (!isActive) {
    redirect("/dashboard");
  }
}
