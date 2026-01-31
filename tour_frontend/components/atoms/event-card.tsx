import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
      <div className="overflow-hidden rounded-[16px] h-[320px]">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="px-4 pb-3 pt-2 bg-white">
        <h3 className="font-display text-[32px] font-semibold text-[#1A2B49] text-center">
          {title}
        </h3>
      </div>
    </Link>
  );
}
