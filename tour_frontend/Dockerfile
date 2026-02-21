# Multi-stage Dockerfile for Next.js Frontend using Bun

# Development stage
FROM oven/bun:1 AS development

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock* ./

RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "run", "dev"]

# Builder stage
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time settings for BetterAuth (required for Next.js static generation)
ARG BETTER_AUTH_SECRET=build-time-placeholder-secret-change-in-production
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG S3_PUBLIC_BASE_URL=
ARG S3_ENDPOINT=
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV S3_PUBLIC_BASE_URL=${S3_PUBLIC_BASE_URL}
ENV S3_ENDPOINT=${S3_ENDPOINT}

RUN bun run build

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy standalone build output (much smaller than full node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

CMD ["bun", "run", "server.js"]
