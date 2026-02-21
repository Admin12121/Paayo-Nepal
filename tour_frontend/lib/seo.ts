// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD Structured Data Helpers for Paayo Nepal
//
// Usage in pages:
//   import { generateArticleJsonLd } from "@/lib/seo";
//   <script type="application/ld+json"
//     dangerouslySetInnerHTML={{ __html: JSON.stringify(generateArticleJsonLd({...})) }}
//   />
// ─────────────────────────────────────────────────────────────────────────────

import { PUBLIC_APP_URL } from "@/lib/app-url";

const SITE_NAME = "Paayo Nepal";
const BASE_URL = PUBLIC_APP_URL;

// ─── Website (appears on all pages via root layout) ─────────────────────────

export function generateWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: BASE_URL,
    description:
      "Discover amazing destinations, festivals, and activities across Nepal",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: generateOrganization(),
  };
}

// ─── Organization ───────────────────────────────────────────────────────────

export function generateOrganization() {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/favicon.ico`,
    },
  };
}

// ─── BreadcrumbList ─────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href
        ? {
            item: item.href.startsWith("http")
              ? item.href
              : `${BASE_URL}${item.href}`,
          }
        : {}),
    })),
  };
}

// ─── Article / Blog Post ────────────────────────────────────────────────────

export interface ArticleJsonLdInput {
  title: string;
  description?: string;
  slug: string;
  coverImage?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  authorName?: string;
  tags?: string[];
}

export function generateArticleJsonLd(input: ArticleJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description || input.title,
    url: `${BASE_URL}/blogs/${input.slug}`,
    ...(input.coverImage
      ? {
          image: {
            "@type": "ImageObject",
            url: input.coverImage.startsWith("http")
              ? input.coverImage
              : `${BASE_URL}${input.coverImage}`,
          },
        }
      : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt } : {}),
    author: {
      "@type": "Person",
      name: input.authorName || SITE_NAME,
    },
    publisher: generateOrganization(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blogs/${input.slug}`,
    },
    ...(input.tags && input.tags.length > 0
      ? { keywords: input.tags.join(", ") }
      : {}),
  };
}

// ─── Event ──────────────────────────────────────────────────────────────────

export interface EventJsonLdInput {
  title: string;
  description?: string;
  slug: string;
  coverImage?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
}

export function generateEventJsonLd(input: EventJsonLdInput) {
  const startDateTime = input.startDate || new Date().toISOString();

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.title,
    description: input.description || input.title,
    url: `${BASE_URL}/events/${input.slug}`,
    startDate: startDateTime,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.coverImage
      ? {
          image: input.coverImage.startsWith("http")
            ? input.coverImage
            : `${BASE_URL}${input.coverImage}`,
        }
      : {}),
    ...(input.location
      ? {
          location: {
            "@type": "Place",
            name: input.location,
            address: {
              "@type": "PostalAddress",
              addressCountry: "NP",
              name: input.location,
            },
          },
        }
      : {
          location: {
            "@type": "Place",
            name: "Nepal",
            address: {
              "@type": "PostalAddress",
              addressCountry: "NP",
            },
          },
        }),
    organizer: generateOrganization(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };
}

// ─── Tourist Attraction ─────────────────────────────────────────────────────

export interface AttractionJsonLdInput {
  title: string;
  description?: string;
  slug: string;
  coverImage?: string | null;
  address?: string | null;
  rating?: number | null;
  reviewCount?: number;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: Record<string, unknown> | null;
  entryFee?: string | null;
}

export function generateAttractionJsonLd(input: AttractionJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: input.title,
    description: input.description || `Discover ${input.title} in Nepal`,
    url: `${BASE_URL}/attractions/${input.slug}`,
    ...(input.coverImage
      ? {
          image: input.coverImage.startsWith("http")
            ? input.coverImage
            : `${BASE_URL}${input.coverImage}`,
        }
      : {}),
    ...(input.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: input.address,
            addressCountry: "NP",
          },
        }
      : {}),
    ...(input.latitude && input.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: input.latitude,
            longitude: input.longitude,
          },
        }
      : {}),
    ...(input.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.rating,
            ratingCount: input.reviewCount || 1,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(input.entryFee
      ? {
          isAccessibleForFree: input.entryFee.toLowerCase() === "free",
        }
      : {}),
    touristType: "Adventure tourism",
    availableLanguage: ["en", "ne"],
  };
}

// ─── Activity ───────────────────────────────────────────────────────────────

export interface ActivityJsonLdInput {
  title: string;
  description?: string;
  slug: string;
  coverImage?: string | null;
}

export function generateActivityJsonLd(input: ActivityJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: input.title,
    description: input.description || `Experience ${input.title} in Nepal`,
    url: `${BASE_URL}/activities/${input.slug}`,
    ...(input.coverImage
      ? {
          image: input.coverImage.startsWith("http")
            ? input.coverImage
            : `${BASE_URL}${input.coverImage}`,
        }
      : {}),
    touristType: "Adventure tourism",
    availableLanguage: ["en", "ne"],
  };
}

// ─── Region ─────────────────────────────────────────────────────────────────

export interface RegionJsonLdInput {
  name: string;
  description?: string;
  slug: string;
  coverImage?: string | null;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function generateRegionJsonLd(input: RegionJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: input.name,
    description: input.description || `Explore ${input.name} region in Nepal`,
    url: `${BASE_URL}/regions/${input.slug}`,
    ...(input.coverImage
      ? {
          image: input.coverImage.startsWith("http")
            ? input.coverImage
            : `${BASE_URL}${input.coverImage}`,
        }
      : {}),
    ...(input.latitude && input.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: input.latitude,
            longitude: input.longitude,
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      addressRegion: input.province || input.name,
      addressCountry: "NP",
    },
    containedInPlace: {
      "@type": "Country",
      name: "Nepal",
    },
  };
}

// ─── Helper: Render JSON-LD script tag content ──────────────────────────────

export function jsonLdScriptProps(data: Record<string, unknown>) {
  return {
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data),
    },
  };
}
