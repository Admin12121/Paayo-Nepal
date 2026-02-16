import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import AdminHeader from "@/components/dashboard/AdminHeader";
import { DashboardProvider } from "@/lib/contexts/DashboardContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  // Check if user has editor or admin role
  const userRole = (session.user as Record<string, unknown>).role as string;
  const isActive =
    userRole === "admin"
      ? true
      : !!(session.user as Record<string, unknown>).isActive;

  if (userRole !== "admin" && userRole !== "editor") {
    redirect("/");
  }

  return (
    <DashboardProvider value={{ userRole, isActive }}>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader user={session.user} />
        <div className="flex">
          <AdminSidebar userRole={userRole} isActive={isActive} />
          <main className="flex-1 p-8 ml-64 mt-16.25">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
