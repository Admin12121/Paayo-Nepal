import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import AdminHeader from "@/components/dashboard/AdminHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
      <SidebarProvider>
        <div className="flex h-svh w-full overflow-hidden bg-zinc-100/60">
          {/*<AdminHeader user={session.user} />*/}
          <AdminSidebar
            userRole={userRole}
            isActive={isActive}
            user={session.user}
          />

          <SidebarInset className="pt-5">
            <main className="h-[calc(100svh-4rem)] w-full overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </DashboardProvider>
  );
}
