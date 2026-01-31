"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Post } from "@/lib/api-client";

interface HeroSectionProps {
  posts: Post[];
}

export function HeroSection({ posts }: HeroSectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % posts.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [posts.length]);

  if (!posts || posts.length === 0) return null;

  const slide = posts[currentSlide];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % posts.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + posts.length) % posts.length);
  };

  const publishedDate = slide.published_at
    ? new Date(slide.published_at)
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        .toUpperCase()
    : "";

  return (
    <section className="relative h-[500px] md:h-[700px] w-full overflow-hidden bg-gray-900">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: slide.featured_image
            ? `url(${slide.featured_image})`
            : undefined,
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      {posts.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6 text-gray-800" />
          </button>
        </>
      )}

      <div className="relative h-full flex flex-col justify-end pb-12 sm:pb-16">
        <div className="text-white px-6 sm:px-8 lg:px-12 max-w-4xl z-10">
          <h1 className="font-display text-4xl sm:text-3xl lg:text-4xl xl:text-5xl mb-8 leading-[1.1] tracking-tight uppercase">
            {slide.title}
          </h1>
          <div className="flex items-center gap-6 mb-5 text-xs sm:text-sm font-light tracking-[0.15em] uppercase">
            {publishedDate && <span>{publishedDate}</span>}
            <span className="text-white/80">{slide.views} Views</span>
          </div>
          <Link
            href={`/blogs/${slide.slug}`}
            className="relative inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl backdrop-blur-[18.97px] shadow-[inset_9.49px_9.49px_1.58px_-11.07px_rgba(255,255,255,0.5),inset_6.32px_6.32px_3.16px_-6.32px_#B3B3B3,inset_-6.32px_-6.32px_3.16px_-6.32px_#B3B3B3,inset_0px_0px_0px_1.35px_#999999,inset_0px_0px_69.57px_rgba(242,242,242,0.5)] hover:shadow-[inset_9.49px_9.49px_1.58px_-11.07px_rgba(255,255,255,0.7),inset_6.32px_6.32px_3.16px_-6.32px_#B3B3B3,inset_-6.32px_-6.32px_3.16px_-6.32px_#B3B3B3,inset_0px_0px_0px_1.35px_#999999,inset_0px_0px_69.57px_rgba(242,242,242,0.7)] transition-all"
          >
            <span className="text-white text-xl">View More</span>
            <svg
              width="33"
              height="33"
              viewBox="0 0 33 33"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-7 text-white"
            >
              <path
                d="M9.99262 8.53395L21.4567 4.7126C26.6013 2.99772 29.3964 5.80634 27.6951 10.951L23.8737 22.415C21.3081 30.1253 17.0952 30.1253 14.5296 22.415L13.3954 19.0123L9.99262 17.878C2.28241 15.3125 2.28241 11.113 9.99262 8.53395Z"
                stroke="white"
                strokeWidth="2.7006"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.6514 18.4316L18.4854 13.584"
                stroke="white"
                strokeWidth="2.7006"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      {posts.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
          {posts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide ? "bg-white w-8" : "bg-white/40 w-2"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
