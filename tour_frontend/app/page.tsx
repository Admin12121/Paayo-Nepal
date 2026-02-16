import { HeroSection } from "@/components/sections/Hero";
import { PhotoFeaturesSection } from "@/components/sections/photo-features";
import { VideosSection } from "@/components/sections/Videos";
import { ArticlesSection } from "@/components/sections/articles";
import { EventsSection } from "@/components/sections/events";
import { AttractionsSection } from "@/components/sections/Attractions";
import { RegionsSection } from "@/components/sections/Regions";
import { ActivitiesSection } from "@/components/sections/Activities";
import { InfoUpdatesSection } from "@/components/sections/InfoUpdates";
import { heroSlidesApi, postsApi } from "@/lib/api-client";
import type { ResolvedHeroSlide, Post } from "@/lib/api-client";

export default async function Home() {
  // Try fetching hero slides first (admin-managed hero content)
  let heroSlides: ResolvedHeroSlide[] = [];
  let fallbackPosts: Post[] = [];

  try {
    heroSlides = await heroSlidesApi.list();
  } catch {
    heroSlides = [];
  }

  // If no hero slides are configured, fall back to featured/recent posts
  if (heroSlides.length === 0) {
    try {
      const res = await postsApi.list({ limit: 5, status: "published" });
      fallbackPosts = res.data;
    } catch {
      fallbackPosts = [];
    }
  }

  // Convert hero slides to the shape the HeroSection expects,
  // or fall back to posts
  const heroItems =
    heroSlides.length > 0
      ? heroSlides
          .filter((slide) => slide.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((slide) => ({
            id: slide.id,
            title: slide.title || slide.custom_title || "Paayo Nepal",
            slug: slide.link || slide.custom_link || "#",
            cover_image: slide.image || slide.custom_image || null,
            subtitle: slide.subtitle || slide.custom_subtitle || null,
            published_at: slide.created_at,
            like_count: 0,
            _isHeroSlide: true as const,
          }))
      : fallbackPosts.map((post) => ({
          id: post.id,
          title: post.title,
          slug: `/blogs/${post.slug}`,
          cover_image: post.cover_image || null,
          subtitle: null,
          published_at: post.published_at || post.created_at,
          like_count: post.like_count,
          _isHeroSlide: false as const,
        }));

  return (
    <main>
      <HeroSection slides={heroItems} />
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
