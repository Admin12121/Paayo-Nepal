import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-6 text-left", className)}>
      <h2 className="font-display text-[22px] font-semibold tracking-[0.08em] text-[#1A2B49] uppercase sm:text-[24px]">
        {title}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[#6A7898]">{subtitle}</p>}
    </div>
  );
}
