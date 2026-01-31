import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  connection: mysql.Pool | undefined;
};

const connection =
  globalForDb.connection ??
  mysql.createPool({
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER || "tourism",
    password: process.env.DATABASE_PASSWORD || "tourism_dev_password",
    database: process.env.DATABASE_NAME || "tourism",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema, mode: "default" });

export type Database = typeof db;
