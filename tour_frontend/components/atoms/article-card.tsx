import React from "react";
import Link from "@/components/ui/animated-link";
import { CalendarDays, Eye } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/media-url";
import { NumberTicker } from "@/components/ui/number-ticker";
import FlipText from "@/components/ui/flip-text";

interface ArticleCardProps {
  image: string;
  title: string;
  description: string;
  date?: string;
  views?: number;
  href?: string;
}

export function ArticleCard({
  image,
  title,
  description,
  date = "",
  views = 0,
  href = "#",
}: ArticleCardProps) {
  const normalizedImage = normalizeMediaUrl(image);

  return (
    <Link href={href} className="block group">
      <div className="overflow-hidden rounded-xl border border-[#E8EDF5] bg-white p-3 shadow-[0_6px_16px_rgba(16,33,58,0.08)] transition-shadow hover:shadow-[0_10px_24px_rgba(16,33,58,0.14)]">
        <div className="flex gap-3">
          <div className="h-64 w-64 flex-shrink-0 overflow-hidden rounded-lg">
            {normalizedImage ? (
              <img
                src={normalizedImage}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#E9EEF7] to-[#CBD8EE]" />
            )}
          </div>
          <div className="flex flex-1 flex-col justify-between py-1">
            <div>
              <h3 className="mb-1.5 line-clamp-2 text-xl font-semibold leading-snug text-[#1A2B49]">
                {title}
              </h3>
            <div className="flex items-center gap-4 text-[11px] text-[#7A8AA5]">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{date}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                <NumberTicker
                  value={views}
                  className="tracking-normal text-current dark:text-current"
                />
              </span>
            </div>
              <p className="line-clamp-2 text-base leading-relaxed text-[#66758F] md:text-sm">
                {description}
              </p>
            </div>
            <span className="mt-2 inline-flex items-center gap-1 self-end text-[11px] font-semibold uppercase tracking-[0.08em] text-[#008CFF]">
              <FlipText as="span">Read More</FlipText>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 18l6-6-6-6"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
