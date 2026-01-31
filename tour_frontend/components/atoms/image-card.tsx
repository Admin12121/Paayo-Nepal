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
  // White bottom variant - like event card
  if (variant === "white-bottom") {
    return (
      <Link
        href={href}
        className={cn(
          "block bg-white rounded-[20px] overflow-hidden cursor-pointer group transition-all duration-300",
          className,
        )}
        style={{
          boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div className="overflow-hidden rounded-[16px] aspect-4/3">
          <img
            src={src}
            alt={alt}
            className={cn(
              "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500",
              imageClassName,
            )}
          />
        </div>
        <div className="px-4 pb-3 pt-2 bg-white">
          <h3 className="font-display text-[28px] font-bold text-[#1A2B49]">
            {title}
          </h3>
        </div>
      </Link>
    );
  }

  // Default overlay variant
  return (
    <Link
      href={href}
      className={cn(
        "block relative overflow-hidden cursor-pointer group",
        "rounded-[10px]",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500",
          imageClassName,
        )}
      />
      {/* Orange gradient overlay from bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 40%, rgba(242, 156, 114, 0.95) 100%)",
        }}
      />
      {/* Title at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="font-display text-[36px] font-normal text-white leading-tight">
          {title}
        </h3>
      </div>
    </Link>
  );
}
