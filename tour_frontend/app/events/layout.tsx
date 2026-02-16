import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

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
