import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/media-url";

interface EventCardProps {
  image: string;
  title: string;
  href?: string;
  className?: string;
}

export function EventCard({
  image,
  title,
  href = "#",
  className,
}: EventCardProps) {
  const normalizedImage = normalizeMediaUrl(image);

  return (
    <Link
      href={href}
      className={cn(
        "group block overflow-hidden rounded-xl border border-[#E7ECF4] bg-white shadow-[0_6px_16px_rgba(16,33,58,0.08)] transition-all duration-300 hover:shadow-[0_10px_24px_rgba(16,33,58,0.14)]",
        className,
      )}
    >
      <div className="h-[170px] overflow-hidden">
        {normalizedImage ? (
          <img
            src={normalizedImage}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#E9EEF7] to-[#CBD8EE]" />
        )}
      </div>
      <div className="px-3 py-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[#1A2B49] md:text-base">
          {title}
        </h3>
      </div>
    </Link>
  );
}
