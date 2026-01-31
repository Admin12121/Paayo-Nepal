import { Facebook, Instagram, Phone, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      {/* Top Section - Title, Nav and Newsletter */}
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left - Title and Nav */}
          <div>
            <h2 className="font-display text-3xl font-semibold text-[#1E1E1E] mb-4">
              Paayo Nepal
            </h2>
            <nav className="flex flex-wrap gap-6 text-sm text-gray-600">
              <Link href="/" className="hover:text-[#1E1E1E] transition-colors">
                Home
              </Link>
              <Link
                href="/about"
                className="hover:text-[#1E1E1E] transition-colors"
              >
                About
              </Link>
              <Link
                href="/regions"
                className="hover:text-[#1E1E1E] transition-colors"
              >
                Regions
              </Link>
              <Link
                href="/attractions"
                className="hover:text-[#1E1E1E] transition-colors"
              >
                Attractions
              </Link>
              <Link
                href="/events"
                className="hover:text-[#1E1E1E] transition-colors"
              >
                Events
              </Link>
              <Link
                href="/articles"
                className="hover:text-[#1E1E1E] transition-colors"
              >
                Blog
              </Link>
            </nav>
          </div>

          {/* Right - Newsletter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-sm font-medium text-[#1E1E1E]">
              Join our newsletter
            </span>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="h-10 px-4 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#2196F3] w-[200px]"
              />
              <button className="h-10 px-6 bg-[#2196F3] text-white text-sm font-medium rounded-md hover:bg-[#1976D2] transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Main Footer Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Logo and Description */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/logo.webp"
                alt="Paayo Nepal"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-semibold text-[#1E1E1E]">
                Paayo Nepal
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Paayo Nepal is your gateway to discovering the beauty, culture,
              and adventure of Nepal. Explore destinations, events, and
              activities across every region.
            </p>
            {/* Social Icons */}
            <div className="flex gap-3">
              <a
                href="#"
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E1E1E] mb-4">
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  About us
                </Link>
              </li>
              <li>
                <Link
                  href="/activities"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  href="/articles"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Community
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Testimonial
                </Link>
              </li>
            </ul>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E1E1E] mb-4">
              Explore
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/regions"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Regions
                </Link>
              </li>
              <li>
                <Link
                  href="/attractions"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Attractions
                </Link>
              </li>
              <li>
                <Link
                  href="/activities"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Activities
                </Link>
              </li>
              <li>
                <Link
                  href="/articles"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Events */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E1E1E] mb-4">
              Events
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/events"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Upcoming Events
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Festivals
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  Gallery
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E1E1E] mb-4">
              Contact
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <a
                  href="tel:+9779742412143"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  +977- 9742412143
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <a
                  href="mailto:support@paayonepal.com"
                  className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
                >
                  support@paayonepal.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © 2026 Carefully crafted Content with{" "}
            <span className="text-red-500">❤️</span> by Jeevan Raj Kapadi Bhatt.
          </p>
          <div className="flex gap-6 text-sm">
            <a
              href="#"
              className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
            >
              Terms of Use
            </a>
            <a
              href="#"
              className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
            >
              Legal
            </a>
            <a
              href="#"
              className="text-gray-500 hover:text-[#1E1E1E] transition-colors"
            >
              Site Map
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
