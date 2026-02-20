"use client";

import {
  Search,
  Menu,
  X,
  ChevronDown,
  Flag,
  LayoutDashboard,
  LogIn,
  UserPlus,
  LogOut,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "@/components/ui/animated-link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import FlipText from "@/components/ui/flip-text";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: "home", label: "Home", href: "/" },
    {
      id: "recent-posts",
      label: "Recent Posts",
      href: "/articles",
      chevron: true,
    },
    { id: "explore", label: "Explore", href: "/regions", chevron: true },
    { id: "events", label: "Events and Festivals", href: "/events" },
    { id: "activities", label: "Activities", href: "/activities" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E3E7EE] bg-white">
      <div className="mx-auto flex h-20 w-full max-w-[1820px] items-center justify-between px-4 md:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.webp"
            alt="Paayo Nepal"
            width={88}
            height={48}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.id}
                href={link.href}
                className={`inline-flex items-center gap-2 text-base font-medium tracking-[0.005em] transition-colors ${
                  isActive
                    ? "text-[#0078C0]"
                    : "text-[#2F4B75] hover:text-[#0078C0]"
                }`}
              >
                <FlipText
                  as="span"
                  className={isActive ? "font-semibold" : undefined}
                >
                  {link.label}
                </FlipText>
                {link.chevron ? <ChevronDown className="h-4 w-4" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <form
            className="hidden items-center gap-2 rounded-full border border-[#CCD3DF] bg-white px-5 py-2.5 transition-colors hover:border-[#0078C0] sm:flex"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.querySelector("input");
              const query = input?.value.trim();
              if (query) {
                router.push(`/search?q=${encodeURIComponent(query)}`);
              }
            }}
          >
            <Search className="h-4 w-4 text-[#7B8CA8]" />
            <input
              type="text"
              placeholder="Search"
              className="w-32 bg-transparent text-sm text-[#2E4A75] outline-none placeholder:text-[#95A3BA] md:w-44 lg:w-52"
              aria-label="Search"
            />
          </form>

          <button
            type="button"
            aria-label="Nepal Locale"
            className="hidden items-center justify-center text-xl lg:inline-flex"
          >
            <Flag className="h-4 w-4 text-[#DC2626]" />
          </button>
        </div>

        <button
          className="rounded-lg p-2 lg:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-[#1E1E1E]" />
          ) : (
            <Menu className="h-6 w-6 text-[#1E1E1E]" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-20 border-b border-gray-200 bg-white shadow-lg lg:hidden">
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
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-[#0078C0]"
                      : "text-[#4B5563] hover:bg-gray-50"
                  }`}
                >
                  <FlipText as="span">{link.label}</FlipText>
                </Link>
              );
            })}

            <form
              className="mt-2 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3"
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
              <Search className="h-4 w-4 text-[#0078C0]" />
              <input
                type="text"
                placeholder="Search"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                aria-label="Search"
              />
            </form>

            <div className="mt-2 border-t border-gray-200 pt-2">
              {session?.user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[#4B5563] hover:bg-gray-50"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <FlipText as="span">Dashboard</FlipText>
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[#4B5563] hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4" />
                    <FlipText as="span">Settings</FlipText>
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await signOut();
                      router.push("/");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <FlipText as="span">Sign Out</FlipText>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[#0078C0] hover:bg-blue-50"
                  >
                    <LogIn className="h-4 w-4" />
                    <FlipText as="span">Sign In</FlipText>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[#0078C0] hover:bg-blue-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    <FlipText as="span">Register</FlipText>
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
