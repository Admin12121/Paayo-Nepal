"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/sections/footer";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/lib/store/provider";
import TransitionProviders from "./transition";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isAuth =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  if (isDashboard || isAuth) {
    return (
      <StoreProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </StoreProvider>
    );
  }

  return (
    <TransitionProviders>
      <StoreProvider>
        <Header />
        <main className="pt-20">{children}</main>
        <Footer />
        <Toaster position="top-right" richColors closeButton />
      </StoreProvider>
    </TransitionProviders>
  );
}
