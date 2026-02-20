import Image from "next/image";
import Link from "@/components/ui/animated-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us - Paayo Nepal",
  description:
    "Learn about Paayo Nepal - your gateway to discovering the beauty, culture, and adventure of Nepal.",
};

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative h-[400px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&h=600&fit=crop"
          alt="Nepal landscape"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="font-display text-5xl font-semibold mb-4">
              About Paayo Nepal
            </h1>
            <p className="text-lg max-w-2xl mx-auto opacity-90">
              Your gateway to discovering the beauty, culture, and adventure of
              Nepal
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-[1400px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold text-[#1E1E1E] mb-6">
              Our Mission
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Paayo Nepal is dedicated to promoting the rich cultural heritage,
              breathtaking landscapes, and diverse experiences that Nepal has to
              offer. We connect travelers with authentic Nepali experiences,
              from the towering peaks of the Himalayas to the lush jungles of
              the Terai.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Whether you are seeking adventure through trekking and
              paragliding, spiritual enrichment at ancient temples, or cultural
              immersion in vibrant festivals, Paayo Nepal is your trusted
              companion for exploring every corner of this extraordinary
              country.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden h-[350px]">
            <img
              src="https://images.unsplash.com/photo-1564349913676-5b0f8f4d7b0f?w=600&h=400&fit=crop"
              alt="Nepal culture"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-[1400px] mx-auto px-6">
          <h2 className="font-display text-3xl font-semibold text-[#1E1E1E] text-center mb-12">
            What We Offer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Explore Regions",
                description:
                  "Discover Nepal's diverse regions from Kathmandu Valley to remote mountain districts, each with unique culture and landscapes.",
                href: "/regions",
              },
              {
                title: "Top Attractions",
                description:
                  "Find the best attractions Nepal has to offer, from UNESCO World Heritage Sites to hidden natural wonders.",
                href: "/attractions",
              },
              {
                title: "Activities & Adventures",
                description:
                  "From trekking and rafting to paragliding and bungee jumping, find your next adventure in Nepal.",
                href: "/activities",
              },
              {
                title: "Events & Festivals",
                description:
                  "Experience the vibrant festivals and cultural events that make Nepal a living museum of traditions.",
                href: "/events",
              },
              {
                title: "Travel Articles",
                description:
                  "Read insightful articles and travel guides written by experienced travelers and local experts.",
                href: "/articles",
              },
              {
                title: "Plan Your Trip",
                description:
                  "Get all the information you need to plan your perfect Nepal trip, from visa details to weather guides.",
                href: "/regions",
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold text-[#1E1E1E] mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold text-[#1E1E1E] mb-4">
          Ready to Explore Nepal?
        </h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Start your journey today. Browse our regions, discover attractions,
          and find your next adventure.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/regions"
            className="px-8 py-3 bg-[#0D9488] text-white rounded-lg font-medium hover:bg-[#0B7C72] transition-colors"
          >
            Explore Regions
          </Link>
          <Link
            href="/activities"
            className="px-8 py-3 border border-[#0D9488] text-[#0D9488] rounded-lg font-medium hover:bg-teal-50 transition-colors"
          >
            View Activities
          </Link>
        </div>
      </section>
    </div>
  );
}
