import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const practiceAttempts = pgTable(
  "practice_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    chosen: char("chosen", { length: 1 }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    domains: integer("domains").array().notNull(),
    scenario: text("scenario").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userTime: index("practice_attempts_user_time_idx").on(t.userId, t.createdAt),
    question: index("practice_attempts_question_idx").on(t.questionId),
  }),
);

export const mockRuns = pgTable(
  "mock_runs",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["in_progress", "submitted"] }).notNull(),
    count: integer("count").notNull(),
    scenarios: text("scenarios").array().notNull(),
    seed: bigint("seed", { mode: "number" }).notNull(),
    questionIds: text("question_ids").array().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reportJson: jsonb("report_json"),
    rawCorrect: integer("raw_correct"),
    scaled: integer("scaled"),
    passed: boolean("passed"),
  },
  (t) => ({
    userTime: index("mock_runs_user_time_idx").on(t.userId, t.startedAt),
  }),
);

export const mockAnswers = pgTable(
  "mock_answers",
  {
    runId: text("run_id")
      .notNull()
      .references(() => mockRuns.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    chosen: char("chosen", { length: 1 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.runId, t.questionId] }),
  }),
);

export const coachMessages = pgTable(
  "coach_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userTime: index("coach_messages_user_time_idx").on(t.userId, t.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PracticeAttempt = typeof practiceAttempts.$inferSelect;
export type NewPracticeAttempt = typeof practiceAttempts.$inferInsert;
export type MockRun = typeof mockRuns.$inferSelect;
export type CoachMessage = typeof coachMessages.$inferSelect;
