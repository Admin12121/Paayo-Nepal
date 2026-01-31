import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema/*",
  out: "./lib/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER || "tourism",
    password: process.env.DATABASE_PASSWORD || "tourism_dev_password",
    database: process.env.DATABASE_NAME || "tourism",
  },
} satisfies Config;
