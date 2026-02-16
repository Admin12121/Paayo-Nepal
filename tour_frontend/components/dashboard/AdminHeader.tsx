"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutAndClear } from "@/lib/auth-client";
import Button from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
    await signOutAndClear();
    router.push("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900" />

          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="text-lg font-bold text-blue-600 md:text-xl">
              Paayo Nepal
            </div>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              {user.role === "admin" ? "Admin" : "Editor"}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />

          <div className="hidden items-center gap-3 border-l border-zinc-200 pl-3 sm:flex">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-zinc-900">
                {user.name || "User"}
              </p>
              <p className="text-xs text-zinc-500">{user.email || ""}</p>
            </div>

            {user.image ? (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                <UserIcon className="h-5 w-5 text-blue-600" />
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-9 w-9 rounded-lg text-zinc-600 hover:bg-red-50 hover:text-red-600"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
