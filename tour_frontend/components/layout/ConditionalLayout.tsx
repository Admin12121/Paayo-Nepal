"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/sections/footer";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const isAuth =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  if (isDashboard || isAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}
