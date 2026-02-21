import { redirect } from "next/navigation";
import UsersManagement from "@/components/dashboard/UsersManagement";
import { getServerSession } from "@/lib/server-session";

export default async function UsersPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
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
