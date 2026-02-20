import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone build for Docker
  output: "standalone",

  // Server-only packages — prevent bundling Node.js modules (pg, redis, etc.)
  // into the client bundle. These are used by auth-server.ts which is
  // dynamically imported by api-client.ts for server-side session extraction.
  serverExternalPackages: ["pg", "redis"],

  // Image optimization configuration
  images: {
    localPatterns: [
      {
        // Allow all local assets from /public (e.g. /logo.webp) and rewritten uploads.
        pathname: "/**",
      },
    ],
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
        // Allow images from the nginx reverse proxy
        protocol: "http",
        hostname: "nginx",
      },
      {
        // Allow images from the backend service (Docker internal)
        protocol: "http",
        hostname: "backend",
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
    optimizePackageImports: ["lucide-react", "@reduxjs/toolkit"],
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

  // -------------------------------------------------------------------------
  // Rewrites
  //
  // In production, nginx handles all routing:
  //   /api/auth/*     → Next.js (BetterAuth)
  //   /api/notifications/* → Next.js (notification routes / SSE proxy)
  //   /api/*          → Rust backend (all other data API)
  //   /uploads/*      → Rust backend (static files)
  //   /*              → Next.js (SSR pages)
  //
  // We always keep /uploads rewrite active for Next Image optimization.
  // Without it, `/_next/image?url=/uploads/...` can fail with 400 when Next.js
  // is accessed directly (or from a different host than nginx/backend).
  //
  // In development (no nginx), we also need /api rewrite so that:
  //   - /api/* requests from the browser reach the Rust backend
  //     (except /api/auth/* which stays in Next.js for BetterAuth)
  //   - /uploads/* requests reach the Rust backend for static files
  //
  // The DOCKER_ENV variable is set in docker-compose.yml. In Docker mode we
  // avoid /api rewrite to prevent auth route proxy conflicts, but /uploads
  // rewrite remains enabled so image optimization stays reliable.
  //
  // Note: /api/auth/* is handled by Next.js App Router routes
  // (app/api/auth/[...all]/route.ts, app/api/auth/sync-session/route.ts,
  // app/api/auth/invalidate-session-cache/route.ts) and is NOT rewritten.
  // Next.js matches App Router routes BEFORE rewrites, so these routes
  // take priority automatically.
  // -------------------------------------------------------------------------
  async rewrites() {
    // Allow explicit opt-out when an external reverse-proxy is guaranteed.
    // Keeping rewrites enabled by default avoids localhost `/api/*` 404s
    // when Next.js is accessed directly (without nginx in front).
    //
    // In Docker dev/prod, nginx is always the source of truth for routing.
    // Rewriting `/api/*` inside Next in that mode can hijack `/api/auth/*`
    // flows and cause incorrect upstream behavior.
    // Resolve backend origin for rewrites.
    const backendBase =
      process.env.BACKEND_URL ||
      (process.env.INTERNAL_API_URL
        ? process.env.INTERNAL_API_URL.replace(/\/api\/?$/, "")
        : "http://localhost:8080");

    const rewrites = [
      // Static uploads → Rust backend
      {
        source: "/uploads/:path*",
        destination: `${backendBase}/uploads/:path*`,
      },
    ];

    // In Docker mode (or explicit opt-out), keep only uploads rewrite.
    // This protects /api/auth/* routing while still fixing image loads.
    if (
      process.env.DISABLE_DEV_API_REWRITES === "true" ||
      process.env.DOCKER_ENV === "true"
    ) {
      return rewrites;
    }

    rewrites.push(
      // API requests → Rust backend (except /api/auth/* which is handled
      // by Next.js App Router routes — those match before rewrites).
      //
      // This rewrite only applies in development. In production, nginx
      // routes /api/* directly to Rust and /api/auth/* to Next.js.
      {
        source: "/api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
    );

    return rewrites;
  },
};

export default nextConfig;
