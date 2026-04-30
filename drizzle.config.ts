import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run drizzle-kit");
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
} satisfies Config;
