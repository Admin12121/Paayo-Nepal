import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createClient, type RedisClientType } from "redis";
import { db } from "./db";
import * as schema from "./db/schema";
import { notifications } from "./db/schema/notifications";

// ---------------------------------------------------------------------------
// Shared Redis client (Phase 0.9 — one connection, not per-registration)
// ---------------------------------------------------------------------------
const redisUrl =
  process.env.REDIS_URL ||
  `redis://:${process.env.REDIS_PASSWORD || ""}@${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`;

let redisClient: RedisClientType | null = null;
let redisReady = false;
let redisErrorLogged = false;

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BETTER_AUTH_URL ||
  "http://localhost:3000";

function normalizeTrustedOrigin(
  value: string | undefined | null,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // BetterAuth supports wildcard origin patterns such as http://localhost:*.
  if (trimmed.includes("*")) {
    return trimmed.replace(/\/+$/, "");
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function collectTrustedOrigins(
  values: Array<string | undefined | null>,
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeTrustedOrigin(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const staticTrustedOrigins = collectTrustedOrigins([
  appBaseUrl,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
  "http://localhost",
  "http://localhost:80",
  "http://localhost:3000",
  "https://localhost",
  "https://localhost:443",
  "https://localhost:3000",
  "http://127.0.0.1",
  "http://127.0.0.1:80",
  "http://127.0.0.1:3000",
  "https://127.0.0.1",
  "https://127.0.0.1:443",
  "https://127.0.0.1:3000",
  "http://[::1]",
  "http://[::1]:80",
  "http://[::1]:3000",
  "https://[::1]",
  "https://[::1]:443",
  "https://[::1]:3000",
  // Port-flexible localhost patterns for reverse-proxy setups.
  "http://localhost:*",
  "https://localhost:*",
  "http://127.0.0.1:*",
  "https://127.0.0.1:*",
  "http://[::1]:*",
  "https://[::1]:*",
  ...envTrustedOrigins,
]);

function resolveDevRequestOrigins(request?: Request): string[] {
  if (!request || process.env.NODE_ENV === "production") {
    return [];
  }

  const origins = new Set<string>();
  const addOrigin = (value: string | undefined | null) => {
    const normalized = normalizeTrustedOrigin(value);
    if (normalized) {
      origins.add(normalized);
    }
  };

  addOrigin(request.headers.get("origin"));
  addOrigin(request.headers.get("referer"));

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedPort = request.headers.get("x-forwarded-port");
  if (forwardedProto && forwardedHost) {
    const proto = forwardedProto.split(",")[0]?.trim();
    const host = forwardedHost.split(",")[0]?.trim();
    const port = forwardedPort?.split(",")[0]?.trim();

    if (proto && host) {
      const hostWithPort =
        port && !host.includes(":") ? `${host}:${port}` : host;
      addOrigin(`${proto}://${hostWithPort}`);
    }
  }

  const hostHeader = request.headers.get("host");
  if (hostHeader) {
    const host = hostHeader.split(",")[0]?.trim();
    const proto = forwardedProto?.split(",")[0]?.trim() || "http";
    if (host) {
      addOrigin(`${proto}://${host}`);
    }
  }

  return Array.from(origins);
}

async function getRedisClient(): Promise<RedisClientType | null> {
  // During next build there is no Redis available — skip entirely
  if (process.env.NEXT_PHASE === "phase-production-build") return null;

  if (redisClient && redisReady) return redisClient;

  try {
    redisClient = createClient({ url: redisUrl }) as RedisClientType;

    redisClient.on("error", (err) => {
      // Log only the first error to avoid spamming build/startup logs
      if (!redisErrorLogged) {
        redisErrorLogged = true;
        console.warn("[auth-server] Redis unavailable:", err.message);
      }
      redisReady = false;
    });

    redisClient.on("ready", () => {
      redisReady = true;
      redisErrorLogged = false; // Reset so future disconnects are logged once
    });

    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch (err) {
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      console.warn(
        "[auth-server] Failed to connect to Redis:",
        (err as Error).message,
      );
    }
    redisClient = null;
    redisReady = false;
    return null;
  }
}

// Eagerly initialise at runtime (non-blocking — failures are logged, not thrown)
if (process.env.NEXT_PHASE !== "phase-production-build") {
  getRedisClient().catch(() => {});
}

// ---------------------------------------------------------------------------
// BetterAuth configuration
// ---------------------------------------------------------------------------
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactorTable,
      passkey: schema.passkeyTable,
    },
  }),
  appName: "Paayo Nepal",
  baseURL: appBaseUrl,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production",
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: async (password: string) => {
        return bcrypt.hash(password, 10);
      },
      verify: async ({
        hash,
        password,
      }: {
        hash: string;
        password: string;
      }) => {
        return bcrypt.compare(password, hash);
      },
    },
  },
  socialProviders: {
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
          },
        }
      : {}),
  },
  plugins: [
    twoFactor({
      issuer: "Paayo Nepal",
      otpOptions: {
        period: 30,
        digits: 6,
      },
    }),
    passkey({
      rpName: "Paayo Nepal",
      rpID: process.env.PASSKEY_RP_ID || "localhost",
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day — update session if older than this
    cookieCache: {
      enabled: true,
      maxAge: 30, // 30 seconds — keep short so isActive updates propagate quickly after admin verification
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "editor",
        input: false, // Users can't set their own role
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // Users cannot set their own active status
      },
      bannedAt: {
        type: "date",
        required: false,
        defaultValue: null,
        input: false,
      },
    },
    modelHooks: {
      create: {
        before: async (user: { role?: string; isActive?: boolean }) => {
          // SECURITY: Block admin role assignment from user input
          if (user.role === "admin") {
            throw new Error(
              "Admin users cannot be created through registration",
            );
          }
          // Force inactive for all new signups (admin must activate)
          user.isActive = false;
          return user;
        },
      },
      update: {
        before: async (user: { role?: string }) => {
          // The role field has input:false so users can't set it via API.
          // Don't throw here as this hook fires during sign-in for existing
          // users (including the admin). Additional role protection is handled
          // at the API / backend level.
          return user;
        },
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Notify all admins about new registration
          try {
            const admins = await db
              .select({ id: schema.user.id })
              .from(schema.user)
              .where(eq(schema.user.role, "admin"));

            // Acquire shared Redis client once (may be null if unavailable)
            const redis = await getRedisClient();

            for (const admin of admins) {
              const notificationId = crypto.randomUUID();

              // Phase 0.8 — use correct PG column names
              const notification = {
                id: notificationId,
                recipientId: admin.id,
                type: "new_user" as const,
                title: "New Account Registration",
                message: `${user.name || user.email} has registered and needs approval.`,
                actionUrl: "/dashboard/users",
                isRead: false,
              };

              // Insert into database via Drizzle (pointing at PG now)
              await db.insert(notifications).values(notification);

              // Publish to Redis for real-time SSE (Phase 0.9 — reuse client)
              if (redis) {
                try {
                  await redis.publish(
                    `notifications:${admin.id}`,
                    JSON.stringify({
                      id: notificationId,
                      type: notification.type,
                      title: notification.title,
                      message: notification.message,
                      actionUrl: notification.actionUrl,
                    }),
                  );

                  // Also publish updated unread count so SSE clients refresh
                  const [row] = await db
                    .select({
                      count: schema.notifications.id,
                    })
                    .from(schema.notifications)
                    .where(eq(schema.notifications.recipientId, admin.id));

                  // We can't easily do a COUNT(*) with just drizzle select,
                  // but the backend SSE handler will also poll — so a simple
                  // publish with the notification payload is sufficient.
                } catch (redisErr) {
                  console.error(
                    "[auth-server] Failed to publish notification to Redis:",
                    redisErr,
                  );
                }
              }
            }
          } catch (err) {
            console.error(
              "[auth-server] Failed to create registration notification:",
              err,
            );
          }
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  trustedOrigins: async (request) => {
    return Array.from(
      new Set([...staticTrustedOrigins, ...resolveDevRequestOrigins(request)]),
    );
  },
  // Rate limiting for auth endpoints
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 10, // max 10 requests per minute
  },
});

// Export types
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
