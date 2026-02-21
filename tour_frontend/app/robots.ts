import type { MetadataRoute } from "next";
import { PUBLIC_APP_URL } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = PUBLIC_APP_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/login",
          "/register",
          "/forgot-password",
          "/_next/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/dashboard/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
