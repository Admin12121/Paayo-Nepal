import {
  Facebook,
  Instagram,
  Mail,
  Phone,
  Youtube,
  Linkedin,
} from "lucide-react";
import Image from "next/image";
import Link from "@/components/ui/animated-link";

export function Footer() {
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@paayonepal.com";

  return (
    <footer className="bg-[#0078C0] text-white">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <div className="grid grid-cols-1 gap-8 border-b border-white/30 pb-7 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h3 className="font-display text-2xl font-semibold">
              Get Social With Us
            </h3>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="#"
                className="rounded-full border border-white/50 p-1.5 hover:bg-white/20"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="rounded-full border border-white/50 p-1.5 hover:bg-white/20"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="rounded-full border border-white/50 p-1.5 hover:bg-white/20"
              >
                <Youtube className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="rounded-full border border-white/50 p-1.5 hover:bg-white/20"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.07em] text-white/80">
              Subscribe To Our News Updates
            </p>
            <form className="flex max-w-[420px] items-center gap-2">
              <input
                type="email"
                placeholder="Your Email"
                className="h-9 flex-1 rounded-md border border-white/35 bg-white/10 px-3 text-sm text-white placeholder:text-white/65 outline-none"
              />
              <button
                type="submit"
                className="h-9 rounded-md bg-[#3CA13A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#358E34]"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-7 py-7 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Image
                src="/logo.webp"
                alt="Paayo Nepal"
                width={34}
                height={34}
              />
              <span className="font-display text-xl font-semibold">
                Paayo Nepal
              </span>
            </div>
            <p className="max-w-sm text-sm text-white/85">
              Travel stories, region guides, events, and tourism updates from
              Nepal.
            </p>
            <div className="mt-4 space-y-2 text-sm text-white/85">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> +977-9742412143
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {contactEmail}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
              Quick Links
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/regions" className="hover:text-white">
                  Regions
                </Link>
              </li>
              <li>
                <Link href="/attractions" className="hover:text-white">
                  Attractions
                </Link>
              </li>
              <li>
                <Link href="/activities" className="hover:text-white">
                  Activities
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
              Discover
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>
                <Link href="/events" className="hover:text-white">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/videos" className="hover:text-white">
                  Videos
                </Link>
              </li>
              <li>
                <Link href="/photos" className="hover:text-white">
                  Photos
                </Link>
              </li>
              <li>
                <Link href="/articles" className="hover:text-white">
                  Articles
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
              Company
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>
                <Link href="/about" className="hover:text-white">
                  About
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-white">
                  Search
                </Link>
              </li>
              <li>
                <Link href="/sitemap.xml" className="hover:text-white">
                  Sitemap
                </Link>
              </li>
              <li>
                <Link href="/robots.txt" className="hover:text-white">
                  Robots
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/25 pt-4 text-xs text-white/75 mb-20 flex justify-between">
          <div>
            Copyright © {new Date().getFullYear()} Paayo Nepal. All rights
            reserved.
          </div>
          <div>Development by <a target="_blank" href="https://biki.com.np" className="hover:text-white">Admin12121</a></div>
        </div>
      </div>
    </footer>
  );
}
