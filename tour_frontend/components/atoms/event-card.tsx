import React from "react";
import Link from "@/components/ui/animated-link";
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
        "group block transition-all duration-300",
        className,
      )}
    >
      <div className="h-[270px] overflow-hidden">
        {normalizedImage ? (
          <img
            src={normalizedImage}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 rounded-xl"
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
