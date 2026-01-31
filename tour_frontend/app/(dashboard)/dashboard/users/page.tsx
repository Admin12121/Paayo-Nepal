import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import UsersManagement from "@/components/dashboard/UsersManagement";

export default async function UsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as Record<string, unknown>).role !== "admin"
  ) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        User Management
      </h1>
      <UsersManagement />
    </div>
  );
}
