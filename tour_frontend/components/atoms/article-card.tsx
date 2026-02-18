import React from "react";
import Link from "next/link";

interface ArticleCardProps {
  image: string;
  title: string;
  description: string;
  href?: string;
}

export function ArticleCard({
  image,
  title,
  description,
  href = "#",
}: ArticleCardProps) {
  return (
    <Link href={href} className="block group">
      <div className="overflow-hidden rounded-xl border border-[#E8EDF5] bg-white p-3 shadow-[0_6px_16px_rgba(16,33,58,0.08)] transition-shadow hover:shadow-[0_10px_24px_rgba(16,33,58,0.14)]">
        <div className="flex gap-3">
          <div className="h-[96px] w-[128px] flex-shrink-0 overflow-hidden rounded-lg md:h-[104px] md:w-[146px]">
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex flex-1 flex-col justify-between py-1">
            <div>
              <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-[#1A2B49] md:text-base">
                {title}
              </h3>
              <p className="line-clamp-2 text-xs leading-relaxed text-[#66758F] md:text-sm">
                {description}
              </p>
            </div>
            <span className="mt-2 inline-flex items-center gap-1 self-end text-[11px] font-semibold uppercase tracking-[0.08em] text-[#008CFF]">
              View All
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
