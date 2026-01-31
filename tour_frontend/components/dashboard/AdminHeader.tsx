"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";

interface AdminHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
}

export default function AdminHeader({ user }: AdminHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="text-xl font-bold text-blue-600">Paayo Nepal</div>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            {user.role === "admin" ? "Admin" : "Editor"}
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <NotificationBell />

          {/* User menu */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {user.name}
              </div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>

            {user.image ? (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
