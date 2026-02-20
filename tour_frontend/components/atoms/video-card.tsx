import React from "react";
import Link from "@/components/ui/animated-link";
import { Eye, Play } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/media-url";
import { NumberTicker } from "@/components/ui/number-ticker";

interface VideoCardProps {
  thumbnail: string;
  title: string;
  duration: string;
  views: number;
  channel?: string;
  channelImage?: string;
  date?: string;
  href?: string;
}

export function VideoCard({
  thumbnail,
  title,
  duration,
  views,
  date = "Jul 15, 2025",
  href = "#",
}: VideoCardProps) {
  const normalizedThumbnail = normalizeMediaUrl(thumbnail);

  return (
    <Link href={href} className="block">
      <div className="group space-y-2.5">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-200">
          {normalizedThumbnail ? (
            <img
              src={normalizedThumbnail}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800">
              <Play className="h-8 w-8 text-white/60" />
            </div>
          )}

          <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
            <Eye className="h-3 w-3" />
            <NumberTicker
              value={views}
              className="tracking-normal text-current dark:text-current"
            />
          </div>

          {duration && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
              {duration}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-[#1E1E1E] transition-colors group-hover:text-[#0078C0]">
            {title}
          </h4>
          <p className="text-xs text-[#868383]">
            {date} |{" "}
            <NumberTicker
              value={views}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            views
          </p>
        </div>
      </div>
    </Link>
  );
}
