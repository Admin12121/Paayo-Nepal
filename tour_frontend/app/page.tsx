import { HeroSection } from "@/components/sections/Hero";
import { PhotoFeaturesSection } from "@/components/sections/photo-features";
import { VideosSection } from "@/components/sections/Videos";
import { ArticlesSection } from "@/components/sections/articles";
import { EventsSection } from "@/components/sections/events";
import { AttractionsSection } from "@/components/sections/Attractions";
import { RegionsSection } from "@/components/sections/Regions";
import { ActivitiesSection } from "@/components/sections/Activities";
import { InfoUpdatesSection } from "@/components/sections/InfoUpdates";
import { postsApi } from "@/lib/api-client";

export default async function Home() {
  // Fetch featured posts for the hero section
  let heroPosts: Awaited<ReturnType<typeof postsApi.list>>["data"] = [];
  try {
    const res = await postsApi.list({ limit: 5, status: "published" });
    heroPosts = res.data;
  } catch {
    heroPosts = [];
  }

  return (
    <main>
      <HeroSection posts={heroPosts} />
      <PhotoFeaturesSection />
      <VideosSection />
      <ArticlesSection />
      <EventsSection />
      <AttractionsSection />
      <RegionsSection />
      <ActivitiesSection />
      <InfoUpdatesSection />
    </main>
  );
}
