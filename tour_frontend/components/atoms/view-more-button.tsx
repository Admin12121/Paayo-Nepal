import { cn } from "@/lib/utils";
import Link from "next/link";

interface ViewMoreButtonProps {
  className?: string;
  href?: string;
  label?: string;
}

export function ViewMoreButton({
  className,
  href = "#",
  label = "View All",
}: ViewMoreButtonProps) {
  return (
    <div className={cn("mt-5 flex justify-end", className)}>
      <Link href={href} className="group inline-flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#008CFF]">
          {label}
        </span>
        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#008CFF] text-[#008CFF] transition-colors group-hover:bg-[#008CFF] group-hover:text-white">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </Link>
    </div>
  );
}
