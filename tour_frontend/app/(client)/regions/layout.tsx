import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

export const metadata: Metadata = {
  title: "Regions of Nepal",
  description:
    "Explore Nepal's diverse regions from Kathmandu Valley to remote mountain districts. Discover unique cultures, landscapes, and hidden gems across all provinces.",
  openGraph: {
    title: "Regions of Nepal",
    description:
      "Explore Nepal's diverse regions from Kathmandu Valley to remote mountain districts. Discover unique cultures, landscapes, and hidden gems across all provinces.",
    url: `${BASE_URL}/regions`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Regions of Nepal | Paayo Nepal",
    description:
      "Explore Nepal's diverse regions from Kathmandu Valley to remote mountain districts. Discover unique cultures, landscapes, and hidden gems across all provinces.",
  },
  alternates: {
    canonical: `${BASE_URL}/regions`,
  },
};

export default function RegionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
