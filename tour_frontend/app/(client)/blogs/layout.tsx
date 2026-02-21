import type { Metadata } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Blogs & Stories",
  description:
    "Read travel blogs, personal stories, and in-depth guides about Nepal. From Himalayan treks to cultural deep-dives, get inspired for your next adventure.",
  openGraph: {
    title: "Blogs & Stories",
    description:
      "Read travel blogs, personal stories, and in-depth guides about Nepal. From Himalayan treks to cultural deep-dives, get inspired for your next adventure.",
    url: `${BASE_URL}/blogs`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blogs & Stories | Paayo Nepal",
    description:
      "Read travel blogs, personal stories, and in-depth guides about Nepal. From Himalayan treks to cultural deep-dives, get inspired for your next adventure.",
  },
  alternates: {
    canonical: `${BASE_URL}/blogs`,
  },
};

export default function BlogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
