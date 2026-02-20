import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

export const metadata: Metadata = {
  title: "Articles & Travel Guides",
  description:
    "Read insightful articles and travel guides about Nepal written by experienced travelers and local experts. Tips, stories, and inspiration for your Nepal journey.",
  openGraph: {
    title: "Articles & Travel Guides",
    description:
      "Read insightful articles and travel guides about Nepal written by experienced travelers and local experts.",
    url: `${BASE_URL}/articles`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Articles & Travel Guides | Paayo Nepal",
    description:
      "Read insightful articles and travel guides about Nepal written by experienced travelers and local experts.",
  },
  alternates: {
    canonical: `${BASE_URL}/articles`,
  },
};

export default function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
