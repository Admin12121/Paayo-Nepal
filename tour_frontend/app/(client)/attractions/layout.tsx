import type { Metadata } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Attractions in Nepal",
  description:
    "Explore Nepal's most captivating destinations, from ancient temples and UNESCO World Heritage Sites to natural wonders and cultural landmarks.",
  openGraph: {
    title: "Attractions in Nepal",
    description:
      "Explore Nepal's most captivating destinations, from ancient temples and UNESCO World Heritage Sites to natural wonders and cultural landmarks.",
    url: `${BASE_URL}/attractions`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Attractions in Nepal | Paayo Nepal",
    description:
      "Explore Nepal's most captivating destinations, from ancient temples and UNESCO World Heritage Sites to natural wonders and cultural landmarks.",
  },
  alternates: {
    canonical: `${BASE_URL}/attractions`,
  },
};

export default function AttractionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
