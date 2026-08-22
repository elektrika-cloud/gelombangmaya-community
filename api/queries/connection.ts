import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../db/schema";
import { env } from "../lib/env";

let dbInstance: MySql2Database<typeof schema> | null = null;
let poolInstance: mysql.Pool | null = null;

export function getDb(): MySql2Database<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  if (env.DATABASE_URL) {
    poolInstance = mysql.createPool(env.DATABASE_URL);
  } else {
    poolInstance = mysql.createPool({
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT, 10),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  dbInstance = drizzle(poolInstance, { schema, mode: "default" });
  return dbInstance;
}
