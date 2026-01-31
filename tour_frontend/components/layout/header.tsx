"use client";

import {
  Search,
  Menu,
  X,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { UserAvatar } from "./UserAvatar";
import { useSession, signOut } from "@/lib/auth-client";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: "home", label: "Home", href: "/" },
    { id: "about", label: "About us", href: "/about" },
    { id: "regions", label: "Regions", href: "/regions" },
    { id: "attractions", label: "Attractions", href: "/attractions" },
    { id: "activities", label: "Activities", href: "/activities" },
    { id: "events", label: "Events", href: "/events" },
    { id: "blog", label: "Blog", href: "/articles" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-gray-200">
      <div className="px-6 h-full flex items-center justify-between max-w-[1400px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image src="/logo.webp" alt="Paayo Nepal" width={40} height={40} />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.id}
                href={link.href}
                className={`text-base font-medium transition-colors ${
                  isActive
                    ? "text-[#0D9488]"
                    : "text-[#4B5563] hover:text-[#0D9488]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Search + User Avatar */}
        <div className="flex items-center gap-3">
          <form
            className="hidden md:flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full hover:border-[#0D9488] transition-colors bg-white"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.querySelector("input");
              const query = input?.value.trim();
              if (query) {
                router.push(`/search?q=${encodeURIComponent(query)}`);
              }
            }}
          >
            <Search className="w-4 h-4 text-[#0D9488]" />
            <input
              type="text"
              placeholder="Search"
              className="outline-none bg-transparent text-sm w-24 placeholder:text-gray-400"
              aria-label="Search"
            />
          </form>
          <div className="hidden lg:block">
            <UserAvatar />
          </div>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6 text-[#1E1E1E]" />
          ) : (
            <Menu className="w-6 h-6 text-[#1E1E1E]" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
          <nav className="flex flex-col p-4">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`py-3 px-4 text-sm font-medium transition-colors rounded-lg ${
                    isActive
                      ? "text-[#0D9488] bg-teal-50"
                      : "text-[#4B5563] hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {/* Mobile search */}
            <form
              className="flex items-center gap-2 px-4 py-3 mt-2 border border-gray-300 rounded-full bg-white"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input");
                const query = input?.value.trim();
                if (query) {
                  setMobileMenuOpen(false);
                  router.push(`/search?q=${encodeURIComponent(query)}`);
                }
              }}
            >
              <Search className="w-4 h-4 text-[#0D9488]" />
              <input
                type="text"
                placeholder="Search"
                className="outline-none bg-transparent text-sm flex-1 placeholder:text-gray-400"
                aria-label="Search"
              />
            </form>

            {/* Mobile auth links */}
            <div className="mt-2 border-t border-gray-200 pt-2">
              {session?.user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-3 px-4 text-sm font-medium text-[#4B5563] hover:bg-gray-50 rounded-lg"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-3 px-4 text-sm font-medium text-[#4B5563] hover:bg-gray-50 rounded-lg"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await signOut();
                      router.push("/");
                    }}
                    className="flex items-center gap-2 w-full py-3 px-4 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-3 px-4 text-sm font-medium text-[#0D9488] hover:bg-teal-50 rounded-lg"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-3 px-4 text-sm font-medium text-[#0D9488] hover:bg-teal-50 rounded-lg"
                  >
                    <UserPlus className="w-4 h-4" />
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
