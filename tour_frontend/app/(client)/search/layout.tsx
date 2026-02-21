import type { Metadata } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

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
