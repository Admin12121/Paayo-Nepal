import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import * as schema from "./db/schema";
import { notifications } from "./db/schema/notifications";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "mysql",
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
    updateAge: 60 * 60 * 24, // 1 day - update session if older than this
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
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
          // Don't throw here as this hook fires during sign-in for existing users
          // (including the admin). Additional role protection is handled at the
          // API/backend level.
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

            for (const admin of admins) {
              const notificationId = crypto.randomUUID();
              const notification = {
                id: notificationId,
                userId: admin.id,
                type: "new_account",
                title: "New Account Registration",
                message: `${user.name || user.email} has registered and needs approval.`,
                link: "/dashboard/users",
                isRead: false,
              };

              // Insert into database
              await db.insert(notifications).values(notification);

              // Publish to Redis for real-time SSE
              try {
                const redisUrl = process.env.REDIS_URL ||
                  `redis://:${process.env.REDIS_PASSWORD}@redis:6379`;
                const { createClient } = await import("redis");
                const redisClient = createClient({ url: redisUrl });
                await redisClient.connect();
                await redisClient.publish(
                  `notifications:${admin.id}`,
                  JSON.stringify({
                    id: notificationId,
                    type: "new_account",
                    title: notification.title,
                    message: notification.message,
                    link: notification.link,
                  })
                );
                await redisClient.disconnect();
              } catch (redisErr) {
                console.error("Failed to publish to Redis:", redisErr);
              }
            }
          } catch (err) {
            console.error("Failed to create notification:", err);
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
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
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
