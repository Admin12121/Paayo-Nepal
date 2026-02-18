import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ImageCardProps {
  src: string;
  alt: string;
  title: string;
  href?: string;
  variant?: "overlay" | "white-bottom";
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
  if (variant === "white-bottom") {
    return (
      <Link
        href={href}
        className={cn(
          "block overflow-hidden rounded-xl border border-[#E7ECF4] bg-white shadow-[0_6px_16px_rgba(16,33,58,0.08)] transition-all duration-300 hover:shadow-[0_10px_22px_rgba(16,33,58,0.14)]",
          className,
        )}
      >
        <div className="overflow-hidden aspect-[4/3]">
          <img
            src={src}
            alt={alt}
            className={cn(
              "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
              imageClassName,
            )}
          />
        </div>
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
        "group relative block cursor-pointer overflow-hidden rounded-xl",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
          imageClassName,
        )}
      />
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
