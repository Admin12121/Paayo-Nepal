import type { Metadata } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

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
