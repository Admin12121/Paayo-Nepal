import { SectionHeading } from "@/components/atoms/section-heading";
import { VideoCard } from "@/components/atoms/video-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { VideosSkeleton } from "@/components/ui/Skeleton";
import { videosApi } from "@/lib/api-client";

export async function VideosSection() {
  let videos;
  try {
    const res = await videosApi.list({ limit: 6 });
    videos = res.data;
  } catch {
    return <VideosSkeleton />;
  }

  if (!videos || videos.length === 0) return <VideosSkeleton />;

  return (
    <section className="py-10 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <SectionHeading title="VIDEOS" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              thumbnail={video.thumbnail_url || ""}
              title={video.title}
              duration={
                video.duration
                  ? `${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, "0")}`
                  : ""
              }
              views={video.view_count ?? 0}
              channel=""
              channelImage=""
            />
          ))}
        </div>

        <ViewMoreButton />
      </div>
    </section>
  );
}
