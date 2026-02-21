import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";

export default async function RegionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  const role = session?.user.role;
  if (!session || role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
