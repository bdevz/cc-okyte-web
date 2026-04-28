import { z } from "zod";
import questionsJson from "@content/questions.json";
import docsJson from "@content/docs.json";
import scenariosJson from "@content/scenarios.json";
import versionJson from "@content/version.json";

const SCENARIO_ENUM = z.enum([
  "customer-support",
  "code-generation",
  "multi-agent-research",
  "developer-productivity",
  "ci-cd",
  "structured-data-extraction",
]);

const DIFFICULTY_ENUM = z.enum(["easy", "medium", "hard"]);

const SOURCE_ENUM = z.enum([
  "official-sample",
  "official-exercise",
  "claude-generated",
  "team-contributed",
]);

const LETTER = z.enum(["A", "B", "C", "D"]);

export const QuestionSchema = z.object({
  id: z.string().regex(/^q-(cs|cg|mar|dp|cicd|sde)-[0-9]{3}$/),
  scenario: SCENARIO_ENUM,
  domains: z.array(z.number().int().min(1).max(5)).min(1).max(5),
  task_statements: z.array(z.string().regex(/^[1-5]\.[1-9]$/)).min(1),
  difficulty: DIFFICULTY_ENUM,
  tags: z.array(z.string()).optional().default([]),
  source: SOURCE_ENUM,
  correct: LETTER,
  review_status: z.enum(["pending", "approved"]).default("approved"),
  stem: z.string().min(1),
  options: z
    .array(
      z.object({
        letter: LETTER,
        text: z.string().min(1),
        explanation: z.string().min(1),
        isCorrect: z.boolean(),
      }),
    )
    .length(4),
  teaches: z.string().min(1),
  sourcePath: z.string().min(1),
});

export type Question = z.infer<typeof QuestionSchema>;
export type Scenario = z.infer<typeof SCENARIO_ENUM>;
export type Difficulty = z.infer<typeof DIFFICULTY_ENUM>;
export type Letter = z.infer<typeof LETTER>;

export const DocSchema = z.object({
  slug: z.string(),
  title: z.string(),
  group: z.enum(["intro", "domain", "cheatsheet"]),
  body: z.string(),
  sourcePath: z.string(),
});

export type Doc = z.infer<typeof DocSchema>;

export const ScenarioReadmeSchema = z.object({
  slug: z.string(),
  scenario: SCENARIO_ENUM,
  title: z.string(),
  body: z.string(),
  sourcePath: z.string(),
});

export type ScenarioReadme = z.infer<typeof ScenarioReadmeSchema>;

export const VersionSchema = z.object({
  hash: z.string(),
  builtAt: z.string(),
  questionCount: z.number(),
  docCount: z.number(),
  scenarioCount: z.number(),
});

export type ContentVersion = z.infer<typeof VersionSchema>;

const _questions: Question[] = z.array(QuestionSchema).parse(questionsJson);
const _docs: Doc[] = z.array(DocSchema).parse(docsJson);
const _scenarios: ScenarioReadme[] = z
  .array(ScenarioReadmeSchema)
  .parse(scenariosJson);
const _version: ContentVersion = VersionSchema.parse(versionJson);

export function getQuestions(): Question[] {
  return _questions;
}

export function getApprovedQuestions(): Question[] {
  return _questions.filter((q) => q.review_status === "approved");
}

export function getQuestionById(id: string): Question | undefined {
  return _questions.find((q) => q.id === id);
}

export function getDocs(): Doc[] {
  return _docs;
}

export function getDocBySlug(slug: string): Doc | undefined {
  return _docs.find((d) => d.slug === slug);
}

export function getScenarioReadmes(): ScenarioReadme[] {
  return _scenarios;
}

export function getContentVersion(): ContentVersion {
  return _version;
}

export const ALL_SCENARIOS: Scenario[] = SCENARIO_ENUM.options;
export const ALL_DIFFICULTIES: Difficulty[] = DIFFICULTY_ENUM.options;
