import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
} from "drizzle-orm/mysql-core";

// BetterAuth required tables
// These tables are used by BetterAuth and read by Rust backend for session verification

export const user = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  role: varchar("role", { length: 20 }).default("editor").notNull(), // 'admin', 'editor', 'user'
  isActive: boolean("is_active").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const session = mysqlTable("session", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const account = mysqlTable("account", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const verification = mysqlTable("verification", {
  id: varchar("id", { length: 36 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// BetterAuth twoFactor plugin table
export const twoFactorTable = mysqlTable("twoFactor", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("userId", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  secret: text("secret"),
  backupCodes: text("backupCodes"),
});

// BetterAuth passkey plugin table
export const passkeyTable = mysqlTable("passkey", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  publicKey: text("publicKey").notNull(),
  userId: varchar("userId", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credentialID").notNull(),
  counter: int("counter").notNull().default(0),
  deviceType: varchar("deviceType", { length: 50 }).notNull(),
  backedUp: boolean("backedUp").notNull().default(false),
  transports: text("transports"),
  aaguid: varchar("aaguid", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
