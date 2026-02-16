import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://paayonepal.com";
const API_URL =
  process.env.BACKEND_API_URL ||
  process.env.INTERNAL_API_URL ||
  "http://localhost:8080/api";

interface SitemapItem {
  slug: string;
  updated_at?: string;
  created_at?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

async function fetchAll<T extends SitemapItem>(endpoint: string): Promise<T[]> {
  try {
    const res = await fetch(
      `${API_URL}${endpoint}?limit=100&status=published`,
      {
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return [];
    const json: PaginatedResponse<T> = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

async function fetchRegions(): Promise<SitemapItem[]> {
  try {
    const res = await fetch(`${API_URL}/regions?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    // Regions may use "name" based slug or direct slug field
    return (json.data || []).map(
      (r: {
        slug?: string;
        id: string;
        updated_at?: string;
        created_at?: string;
      }) => ({
        slug: r.slug || r.id,
        updated_at: r.updated_at,
        created_at: r.created_at,
      }),
    );
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/attractions`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/events`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/activities`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/regions`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  // Fetch dynamic content in parallel
  const [attractions, events, activities, articles, regions] =
    await Promise.all([
      fetchAll("/attractions"),
      fetchAll("/events"),
      fetchAll("/activities"),
      fetchAll("/posts"),
      fetchRegions(),
    ]);

  const attractionPages: MetadataRoute.Sitemap = attractions.map((item) => ({
    url: `${BASE_URL}/attractions/${item.slug}`,
    lastModified: new Date(item.updated_at || item.created_at || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const eventPages: MetadataRoute.Sitemap = events.map((item) => ({
    url: `${BASE_URL}/events/${item.slug}`,
    lastModified: new Date(item.updated_at || item.created_at || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const activityPages: MetadataRoute.Sitemap = activities.map((item) => ({
    url: `${BASE_URL}/activities/${item.slug}`,
    lastModified: new Date(item.updated_at || item.created_at || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((item) => ({
    url: `${BASE_URL}/blogs/${item.slug}`,
    lastModified: new Date(item.updated_at || item.created_at || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const regionPages: MetadataRoute.Sitemap = regions.map((item) => ({
    url: `${BASE_URL}/regions/${item.slug}`,
    lastModified: new Date(item.updated_at || item.created_at || Date.now()),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...attractionPages,
    ...eventPages,
    ...activityPages,
    ...articlePages,
    ...regionPages,
  ];
}
