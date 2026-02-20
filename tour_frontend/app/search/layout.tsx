import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search across all destinations, events, activities, articles, and regions in Nepal. Find exactly what you're looking for on Paayo Nepal.",
  openGraph: {
    title: "Search | Paayo Nepal",
    description:
      "Search across all destinations, events, activities, articles, and regions in Nepal.",
    url: `${BASE_URL}/search`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Search | Paayo Nepal",
    description:
      "Search across all destinations, events, activities, articles, and regions in Nepal.",
  },
  alternates: {
    canonical: `${BASE_URL}/search`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
