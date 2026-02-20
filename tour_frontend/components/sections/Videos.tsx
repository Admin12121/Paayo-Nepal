import { SectionHeading } from "@/components/atoms/section-heading";
import { VideoCard } from "@/components/atoms/video-card";
import { ViewMoreButton } from "@/components/atoms/view-more-button";
import { videosApi } from "@/lib/api-client";

export async function VideosSection() {
  let videos;
  try {
    const res = await videosApi.list({ limit: 6 });
    videos = res.data;
  } catch {
    return null;
  }

  if (!videos || videos.length === 0) return null;

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
              href={`/videos/${video.slug}`}
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

        <ViewMoreButton href="/videos" />
      </div>
    </section>
  );
}
