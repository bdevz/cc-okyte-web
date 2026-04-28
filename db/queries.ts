import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  mockRuns,
  practiceAttempts,
  users,
  type NewPracticeAttempt,
  type User,
} from "./schema";

export async function getOrCreateUser(input: {
  username: string;
  displayName: string;
  role: "user" | "admin";
}): Promise<User> {
  const username = input.username.toLowerCase();
  await db
    .insert(users)
    .values({
      username,
      displayName: input.displayName,
      role: input.role,
    })
    .onConflictDoNothing({ target: users.username });

  // Always upgrade role if the env-driven admin list now includes them, but
  // never downgrade — once an admin, removing from ADMIN_USERNAMES does not
  // strip the role (do that explicitly via the admin UI when it ships).
  if (input.role === "admin") {
    await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.username, username));
  }

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!row) {
    throw new Error(`Failed to upsert user '${username}'`);
  }
  return row;
}

export async function recordPracticeAttempt(input: NewPracticeAttempt) {
  await db.insert(practiceAttempts).values(input);
}

export type DashboardData = {
  totalAttempts: number;
  correctAttempts: number;
  byDomain: { domain: number; total: number; correct: number }[];
  recentAttempts: {
    id: string;
    questionId: string;
    chosen: string;
    isCorrect: boolean;
    createdAt: Date;
  }[];
  recentMocks: {
    id: string;
    startedAt: Date;
    submittedAt: Date | null;
    rawCorrect: number | null;
    scaled: number | null;
    passed: boolean | null;
    status: "in_progress" | "submitted";
  }[];
};

export async function getDashboard(userId: string): Promise<DashboardData> {
  const [totalsRow] = await db
    .select({
      total: count(),
      correct: sql<number>`coalesce(sum(case when ${practiceAttempts.isCorrect} then 1 else 0 end)::int, 0)`,
    })
    .from(practiceAttempts)
    .where(eq(practiceAttempts.userId, userId));

  const byDomainRows = await db.execute<{
    domain: number;
    total: number;
    correct: number;
  }>(sql`
    select d::int as domain,
           count(*)::int as total,
           sum(case when ${practiceAttempts.isCorrect} then 1 else 0 end)::int as correct
    from ${practiceAttempts}, unnest(${practiceAttempts.domains}) as d
    where ${practiceAttempts.userId} = ${userId}
    group by d
    order by d
  `);

  const recentAttempts = await db
    .select({
      id: practiceAttempts.id,
      questionId: practiceAttempts.questionId,
      chosen: practiceAttempts.chosen,
      isCorrect: practiceAttempts.isCorrect,
      createdAt: practiceAttempts.createdAt,
    })
    .from(practiceAttempts)
    .where(eq(practiceAttempts.userId, userId))
    .orderBy(desc(practiceAttempts.createdAt))
    .limit(10);

  const recentMocks = await db
    .select({
      id: mockRuns.id,
      startedAt: mockRuns.startedAt,
      submittedAt: mockRuns.submittedAt,
      rawCorrect: mockRuns.rawCorrect,
      scaled: mockRuns.scaled,
      passed: mockRuns.passed,
      status: mockRuns.status,
    })
    .from(mockRuns)
    .where(eq(mockRuns.userId, userId))
    .orderBy(desc(mockRuns.startedAt))
    .limit(5);

  return {
    totalAttempts: totalsRow?.total ?? 0,
    correctAttempts: Number(totalsRow?.correct ?? 0),
    byDomain: (byDomainRows.rows ?? []).map((r) => ({
      domain: Number(r.domain),
      total: Number(r.total),
      correct: Number(r.correct),
    })),
    recentAttempts: recentAttempts.map((r) => ({
      ...r,
      chosen: String(r.chosen),
    })),
    recentMocks: recentMocks.map((r) => ({
      ...r,
      status: r.status as "in_progress" | "submitted",
    })),
  };
}

export async function listUsersForAdmin() {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.username);
}

export async function questionsAttemptedByUser(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ questionId: practiceAttempts.questionId })
    .from(practiceAttempts)
    .where(eq(practiceAttempts.userId, userId));
  return new Set(rows.map((r) => r.questionId));
}

export { and, eq };
