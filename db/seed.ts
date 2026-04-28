import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { USERS } from "../seeds/users";

async function main() {
  console.log(`Seeding ${USERS.length} users...`);
  for (const u of USERS) {
    await db
      .insert(users)
      .values({
        username: u.username.toLowerCase(),
        displayName: u.displayName,
        role: u.role,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: u.displayName,
          role: u.role,
        },
      });
    console.log(`  ✓ ${u.username} (${u.role})`);
  }

  const [{ count }] = (await db.execute<{ count: string }>(
    sql`select count(*)::text as count from ${users}`,
  )).rows ?? [{ count: "?" }];
  console.log(`Done. users table now has ${count} rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
