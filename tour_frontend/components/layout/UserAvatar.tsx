"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";

export function UserAvatar() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isPending) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-[#0D9488] transition-colors hover:bg-teal-50"
        >
          <LogIn className="h-4 w-4" />
          Sign In
        </Link>
        <Link
          href="/register"
          className="hidden items-center gap-1.5 rounded-full bg-[#0D9488] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B8478] sm:flex"
        >
          <UserPlus className="h-4 w-4" />
          Register
        </Link>
      </div>
    );
  }

  const user = session.user;
  const initials = (user.name || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 focus:outline-none"
        aria-label="User menu"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || ""}
            className="h-9 w-9 rounded-full border-2 border-[#0D9488] object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0D9488] text-sm font-semibold text-white">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <div className="mt-1 border-t border-gray-100 pt-1">
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/");
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
