import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Authentication - Paoyo Nepal",
  description: "Sign in or create an account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      {/* Auth card */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl text-white font-bold">P</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 font-display">
              Paoyo Nepal
            </span>
          </div>
          <p className="text-gray-600 text-sm">Travel & Explore Nepal</p>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          &copy; {new Date().getFullYear()} Paoyo Nepal. All rights reserved.
        </p>
      </div>
    </div>
  );
}
