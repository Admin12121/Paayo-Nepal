import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";

export default async function RegionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (!session || role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
