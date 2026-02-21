import type { Metadata } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

const BASE_URL = PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Events & Festivals in Nepal",
  description:
    "Discover upcoming festivals, cultural celebrations, and special events happening across Nepal. From Dashain to Tihar, find every event worth attending.",
  openGraph: {
    title: "Events & Festivals in Nepal",
    description:
      "Discover upcoming festivals, cultural celebrations, and special events happening across Nepal.",
    url: `${BASE_URL}/events`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Events & Festivals in Nepal | Paayo Nepal",
    description:
      "Discover upcoming festivals, cultural celebrations, and special events happening across Nepal.",
  },
  alternates: {
    canonical: `${BASE_URL}/events`,
  },
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
