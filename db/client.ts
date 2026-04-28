import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __ccOkyteDb__: NodePgDatabase<typeof schema> | undefined;
  // eslint-disable-next-line no-var
  var __ccOkytePool__: Pool | undefined;
}

function getPool(): Pool {
  if (global.__ccOkytePool__) return global.__ccOkytePool__;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  if (process.env.NODE_ENV !== "production") global.__ccOkytePool__ = pool;
  return pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (global.__ccOkyteDb__) return global.__ccOkyteDb__;
  const instance = drizzle(getPool(), { schema, casing: "snake_case" });
  if (process.env.NODE_ENV !== "production") global.__ccOkyteDb__ = instance;
  return instance;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export { schema };
