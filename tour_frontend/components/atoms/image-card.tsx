import React from "react";
import Link from "@/components/ui/animated-link";
import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/media-url";

interface ImageCardProps {
  src: string;
  alt: string;
  title: string;
  href?: string;
  variant?: "overlay" | "white-bottom" | "bottom";
  className?: string;
  imageClassName?: string;
}

export function ImageCard({
  src,
  alt,
  title,
  href = "#",
  variant = "overlay",
  className,
  imageClassName,
}: ImageCardProps) {
  const normalizedSrc = normalizeMediaUrl(src);

  if (variant === "white-bottom") {
    return (
      <Link
        href={href}
        className={cn(
          "group block overflow-hidden rounded-xl border border-[#E7ECF4] bg-white transition-all duration-300 hover:shadow-[0_10px_22px_rgba(16,33,58,0.14)]",
          className,
        )}
      >
        {normalizedSrc ? (
          <img
            src={normalizedSrc}
            alt={alt}
            className={cn("h-full w-full object-cover", imageClassName)}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#E9EEF7] to-[#CBD8EE]" />
        )}
       
        <div className="px-3 py-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[#1A2B49] md:text-base">
            {title}
          </h3>
        </div>
      </Link>
    );
  } else if (variant === "bottom") {
    return (
      <Link
        href={href}
        className={cn(
          "group block transition-all duration-300",
          className,
        )}
      >
        {normalizedSrc ? (
          <img
            src={normalizedSrc}
            alt={alt}
            className={cn("h-full w-full object-cover rounded-xl", imageClassName)}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#E9EEF7] to-[#CBD8EE]" />
        )}

        <div className="px-3 py-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[#1A2B49] md:text-base">
            {title}
          </h3>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-xl",
        className,
      )}
    >
      {normalizedSrc ? (
        <img
          src={normalizedSrc}
          alt={alt}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#12274A] via-[#2D4F7A] to-[#577EAF]" />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.68) 100%)",
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white md:text-base">
          {title}
        </h3>
      </div>
    </Link>
  );
}
