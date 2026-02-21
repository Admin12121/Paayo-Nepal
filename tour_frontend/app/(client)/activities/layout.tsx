import type { Metadata } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Activities & Adventures in Nepal",
  description:
    "From trekking and rafting to paragliding and bungee jumping, discover exciting activities and adventures across Nepal. Plan your next Himalayan adventure.",
  openGraph: {
    title: "Activities & Adventures in Nepal",
    description:
      "From trekking and rafting to paragliding and bungee jumping, discover exciting activities and adventures across Nepal.",
    url: `${BASE_URL}/activities`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Activities & Adventures in Nepal | Paayo Nepal",
    description:
      "From trekking and rafting to paragliding and bungee jumping, discover exciting activities and adventures across Nepal.",
  },
  alternates: {
    canonical: `${BASE_URL}/activities`,
  },
};

export default function ActivitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
