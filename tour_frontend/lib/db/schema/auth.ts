import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

// BetterAuth required tables
// These tables are used by BetterAuth and read by Rust backend for session verification
// Schema mirrors the PostgreSQL migration owned by the Rust backend

export const user = pgTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  role: varchar("role", { length: 20 }).default("editor").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable("session", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const account = pgTable("account", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const verification = pgTable("verification", {
  id: varchar("id", { length: 36 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// BetterAuth twoFactor plugin table
// Note: BetterAuth uses camelCase column names for this table
export const twoFactorTable = pgTable("twoFactor", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("userId", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  secret: text("secret"),
  backupCodes: text("backupCodes"),
});

// BetterAuth passkey plugin table
// Note: BetterAuth uses camelCase column names for this table
export const passkeyTable = pgTable("passkey", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  publicKey: text("publicKey").notNull(),
  userId: varchar("userId", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credentialID").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: varchar("deviceType", { length: 50 }).notNull(),
  backedUp: boolean("backedUp").notNull().default(false),
  transports: text("transports"),
  aaguid: varchar("aaguid", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
});

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
