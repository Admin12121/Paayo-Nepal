import type { Metadata } from "next";
import { Mulish, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { generateWebsiteJsonLd, jsonLdScriptProps } from "@/lib/seo";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Paayo Nepal — Travel & Explore Nepal",
    template: "%s | Paayo Nepal",
  },
  description:
    "Discover amazing destinations, festivals, activities, and cultural experiences across Nepal. Your gateway to exploring the Himalayas and beyond.",
  keywords: [
    "Nepal",
    "travel",
    "tourism",
    "Himalayas",
    "trekking",
    "Kathmandu",
    "Pokhara",
    "festivals",
    "attractions",
    "adventure",
    "culture",
    "explore Nepal",
    "Paayo Nepal",
  ],
  authors: [{ name: "Paayo Nepal" }],
  creator: "Paayo Nepal",
  publisher: "Paayo Nepal",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Paayo Nepal",
    title: "Paayo Nepal — Travel & Explore Nepal",
    description:
      "Discover amazing destinations, festivals, activities, and cultural experiences across Nepal.",
    images: [
      {
        url: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Paayo Nepal — Discover Nepal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Paayo Nepal — Travel & Explore Nepal",
    description:
      "Discover amazing destinations, festivals, activities, and cultural experiences across Nepal.",
    images: [`${BASE_URL}/og-image.jpg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: "travel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = generateWebsiteJsonLd();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#0078C0" />
        <script {...jsonLdScriptProps(websiteJsonLd)} />
      </head>
      <body
        className={`${mulish.variable} ${cormorant.variable} antialiased font-sans`}
      >
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
