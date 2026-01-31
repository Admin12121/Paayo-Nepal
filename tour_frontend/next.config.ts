import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone build for Docker
  output: "standalone",

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        // Allow images from the nginx uploads directory
        protocol: "http",
        hostname: "nginx",
      },
    ],
    // Optimize for common device sizes
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Use modern formats
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for 30 days
    minimumCacheTTL: 2592000,
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ["lucide-react"],
  },

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },

  // Rewrites for static uploads proxy to Rust backend
  // API requests are handled by app/api/[...path]/route.ts for proper auth cookie forwarding
  async rewrites() {
    const backendUrl = process.env.DOCKER_ENV
      ? "http://backend:8080"
      : "http://localhost:8080";

    return [
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
