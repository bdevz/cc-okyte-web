import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import {
  generatedQuestions,
  mockAnswers,
  mockRuns,
  practiceAttempts,
  users,
  type GeneratedQuestion,
  type MockRun,
  type NewGeneratedQuestion,
  type NewPracticeAttempt,
  type User,
} from "./schema";
import {
  QuestionSchema,
  getQuestions as getStaticQuestions,
  type Question,
  type Scenario,
} from "@/lib/content";

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

export type MockRunWithAnswers = MockRun & {
  answers: Record<string, string>;
};

export async function createMockRun(input: {
  id: string;
  userId: string;
  count: number;
  scenarios: string[];
  seed: number;
  questionIds: string[];
}): Promise<MockRun> {
  const [row] = await db
    .insert(mockRuns)
    .values({
      id: input.id,
      userId: input.userId,
      status: "in_progress",
      count: input.count,
      scenarios: input.scenarios,
      seed: input.seed,
      questionIds: input.questionIds,
    })
    .returning();
  return row;
}

export async function getMockRun(
  runId: string,
  userId: string,
): Promise<MockRunWithAnswers | null> {
  const rows = await db
    .select()
    .from(mockRuns)
    .where(and(eq(mockRuns.id, runId), eq(mockRuns.userId, userId)))
    .limit(1);
  const run = rows[0];
  if (!run) return null;

  const answerRows = await db
    .select({
      questionId: mockAnswers.questionId,
      chosen: mockAnswers.chosen,
    })
    .from(mockAnswers)
    .where(eq(mockAnswers.runId, runId));

  const answers: Record<string, string> = {};
  for (const a of answerRows) answers[a.questionId] = String(a.chosen);
  return { ...run, answers };
}

export async function saveMockAnswer(input: {
  runId: string;
  userId: string;
  questionId: string;
  chosen: "A" | "B" | "C" | "D";
}): Promise<{ ok: boolean }> {
  // Confirm the run belongs to this user and is still in progress.
  const [run] = await db
    .select({ status: mockRuns.status })
    .from(mockRuns)
    .where(and(eq(mockRuns.id, input.runId), eq(mockRuns.userId, input.userId)))
    .limit(1);
  if (!run) return { ok: false };
  if (run.status === "submitted") return { ok: false };

  await db
    .insert(mockAnswers)
    .values({
      runId: input.runId,
      questionId: input.questionId,
      chosen: input.chosen,
    })
    .onConflictDoUpdate({
      target: [mockAnswers.runId, mockAnswers.questionId],
      set: { chosen: input.chosen, updatedAt: new Date() },
    });
  return { ok: true };
}

export async function submitMockRun(input: {
  runId: string;
  userId: string;
  reportJson: unknown;
  rawCorrect: number;
  scaled: number;
  passed: boolean;
}): Promise<{ ok: boolean }> {
  const result = await db
    .update(mockRuns)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      reportJson: input.reportJson as any,
      rawCorrect: input.rawCorrect,
      scaled: input.scaled,
      passed: input.passed,
    })
    .where(
      and(
        eq(mockRuns.id, input.runId),
        eq(mockRuns.userId, input.userId),
        eq(mockRuns.status, "in_progress"),
      ),
    )
    .returning({ id: mockRuns.id });
  return { ok: result.length > 0 };
}

export const SCENARIO_TO_PREFIX: Record<Scenario, string> = {
  "customer-support": "cs",
  "code-generation": "cg",
  "multi-agent-research": "mar",
  "developer-productivity": "dp",
  "ci-cd": "cicd",
  "structured-data-extraction": "sde",
};

function generatedRowToQuestion(row: GeneratedQuestion): Question | null {
  const candidate = {
    id: row.id,
    scenario: row.scenario,
    domains: row.domains,
    task_statements: row.taskStatements,
    difficulty: row.difficulty,
    tags: row.tags,
    source: row.source,
    correct: row.correct,
    review_status: row.status === "approved" ? "approved" : "pending",
    stem: row.stem,
    options: row.optionsJson,
    teaches: row.teaches,
    sourcePath: `db:generated_questions/${row.id}`,
  };
  const parsed = QuestionSchema.safeParse(candidate);
  if (!parsed.success) {
    console.error(
      `[queries] generated question ${row.id} failed Zod validation:`,
      parsed.error.flatten(),
    );
    return null;
  }
  return parsed.data;
}

export async function listApprovedGeneratedQuestions(): Promise<Question[]> {
  const rows = await db
    .select()
    .from(generatedQuestions)
    .where(eq(generatedQuestions.status, "approved"));
  return rows
    .map(generatedRowToQuestion)
    .filter((q): q is Question => q !== null);
}

export async function getGeneratedQuestionById(
  id: string,
): Promise<Question | null> {
  const rows = await db
    .select()
    .from(generatedQuestions)
    .where(eq(generatedQuestions.id, id))
    .limit(1);
  if (!rows[0]) return null;
  return generatedRowToQuestion(rows[0]);
}

export async function listPendingGeneratedQuestions(): Promise<
  GeneratedQuestion[]
> {
  return db
    .select()
    .from(generatedQuestions)
    .where(eq(generatedQuestions.status, "pending_review"))
    .orderBy(desc(generatedQuestions.createdAt));
}

export async function nextQuestionId(scenario: Scenario): Promise<string> {
  const prefix = SCENARIO_TO_PREFIX[scenario];
  if (!prefix) throw new Error(`Unknown scenario ${scenario}`);
  const re = new RegExp(`^q-${prefix}-(\\d{3})$`);

  // Static IDs from the compiled bundle.
  let max = 0;
  for (const q of getStaticQuestions()) {
    const m = re.exec(q.id);
    if (m) max = Math.max(max, Number(m[1]));
  }

  // DB IDs across all statuses (so we don't reuse IDs we already issued).
  const dbRows = await db
    .select({ id: generatedQuestions.id })
    .from(generatedQuestions)
    .where(sql`${generatedQuestions.id} LIKE ${`q-${prefix}-%`}`);
  for (const r of dbRows) {
    const m = re.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }

  const next = max + 1;
  if (next > 999) {
    throw new Error(
      `Question ID space for prefix ${prefix} is exhausted (3 digits)`,
    );
  }
  return `q-${prefix}-${String(next).padStart(3, "0")}`;
}

export async function insertGeneratedQuestions(
  rows: NewGeneratedQuestion[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(generatedQuestions).values(rows);
}

export async function reviewGeneratedQuestion(input: {
  id: string;
  reviewerId: string;
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<{ ok: boolean }> {
  const result = await db
    .update(generatedQuestions)
    .set({
      status: input.decision,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      rejectionReason: input.decision === "rejected" ? input.reason ?? null : null,
    })
    .where(
      and(
        eq(generatedQuestions.id, input.id),
        eq(generatedQuestions.status, "pending_review"),
      ),
    )
    .returning({ id: generatedQuestions.id });
  return { ok: result.length > 0 };
}

export { and, eq, inArray };
