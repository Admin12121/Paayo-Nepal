import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

interface SkeletonProps extends ComponentProps<"div"> {}

/**
 * Base Skeleton component with shimmer animation
 * Use this to create loading placeholders that match exact layouts
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-gray-200",
        // Shimmer animation
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

// Hero Section Skeleton - matches Hero.tsx exact layout
export function HeroSkeleton() {
  return (
    <section className="relative h-[500px] md:h-[700px] w-full overflow-hidden bg-gray-900">
      {/* Background shimmer */}
      <Skeleton className="absolute inset-0 rounded-none bg-gray-700" />
      <div className="absolute inset-0 bg-black/30" />

      {/* Navigation arrows */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/20 rounded-full" />
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/20 rounded-full" />

      {/* Content skeleton */}
      <div className="relative h-full flex flex-col justify-end pb-12 sm:pb-16">
        <div className="px-6 sm:px-8 lg:px-12 max-w-4xl z-10">
          {/* Title */}
          <Skeleton className="h-12 w-3/4 mb-4 bg-gray-600" />
          <Skeleton className="h-12 w-1/2 mb-8 bg-gray-600" />
          {/* Meta info */}
          <div className="flex items-center gap-6 mb-5">
            <Skeleton className="h-4 w-32 bg-gray-600" />
            <Skeleton className="h-4 w-20 bg-gray-600" />
          </div>
          {/* Button */}
          <Skeleton className="h-14 w-40 rounded-xl bg-gray-600" />
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full",
              i === 0 ? "bg-white" : "bg-white/40",
            )}
          />
        ))}
      </div>
    </section>
  );
}

// Section Title Skeleton
export function SectionTitleSkeleton() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
  );
}

// Card Skeleton - matches the card layout used in multiple sections
export function CardSkeleton({
  variant = "default",
}: {
  variant?: "default" | "horizontal" | "featured";
}) {
  if (variant === "horizontal") {
    return (
      <div className="flex gap-4 p-4 bg-white rounded-xl shadow-sm">
        <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  if (variant === "featured") {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-white shadow-lg">
        <Skeleton className="w-full aspect-[4/3]" />
        <div className="p-6">
          <Skeleton className="h-6 w-3/4 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  // Default card
  return (
    <div className="rounded-xl overflow-hidden bg-white shadow-sm">
      <Skeleton className="w-full aspect-[16/10]" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// Photo Features Section Skeleton
export function PhotoFeaturesSkeleton() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="relative rounded-xl overflow-hidden bg-white shadow-sm"
            >
              <Skeleton className="w-full aspect-square" />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70">
                <Skeleton className="h-5 w-2/3 bg-gray-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Videos Section Skeleton
export function VideosSkeleton() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden bg-white shadow-sm"
            >
              <div className="relative">
                <Skeleton className="w-full aspect-video" />
                {/* Play button placeholder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Articles Section Skeleton
export function ArticlesSkeleton() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Events Section Skeleton
export function EventsSkeleton() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden bg-white shadow-sm"
            >
              <Skeleton className="w-full aspect-[16/10]" />
              <div className="p-4">
                {/* Date badge */}
                <Skeleton className="h-6 w-32 mb-3 rounded-full" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Attractions Section Skeleton
export function AttractionsSkeleton() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} variant="featured" />
          ))}
        </div>
      </div>
    </section>
  );
}

// Regions Section Skeleton
export function RegionsSkeleton() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="relative rounded-xl overflow-hidden aspect-square bg-white shadow-sm"
            >
              <Skeleton className="absolute inset-0" />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70">
                <Skeleton className="h-4 w-2/3 mx-auto bg-gray-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Activities Section Skeleton
export function ActivitiesSkeleton() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <SectionTitleSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden bg-white shadow-sm"
            >
              <Skeleton className="w-full aspect-[4/3]" />
              <div className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Full Homepage Skeleton
export function HomePageSkeleton() {
  return (
    <main>
      <HeroSkeleton />
      <PhotoFeaturesSkeleton />
      <VideosSkeleton />
      <ArticlesSkeleton />
      <EventsSkeleton />
      <AttractionsSkeleton />
      <RegionsSkeleton />
      <ActivitiesSkeleton />
    </main>
  );
}
