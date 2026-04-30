import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  ALL_SCENARIOS,
  getApprovedQuestions,
  getDocs,
  type Difficulty,
  type Question,
  type Scenario,
} from "./content";

const MODEL = process.env.GENERATOR_MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

/**
 * Schema Claude must satisfy via tool-use. The body schema is intentionally
 * minimal — we assign the id, source, status, and review_status server-side
 * after validation. Claude only generates the creative content.
 */
const GeneratedQuestionSchema = z.object({
  scenario: z.enum(ALL_SCENARIOS as [Scenario, ...Scenario[]]),
  domains: z.array(z.number().int().min(1).max(5)).min(1).max(5),
  task_statements: z.array(z.string().regex(/^[1-5]\.[1-9]$/)).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z.array(z.string()).default([]),
  correct: z.enum(["A", "B", "C", "D"]),
  stem: z.string().min(40),
  options: z
    .array(
      z.object({
        letter: z.enum(["A", "B", "C", "D"]),
        text: z.string().min(20),
        explanation: z.string().min(20),
      }),
    )
    .length(4),
  teaches: z.string().min(20),
});

export type GeneratedQuestionDraft = z.infer<typeof GeneratedQuestionSchema>;

const ToolInputSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).min(1),
});

const SUBMIT_QUESTIONS_TOOL: Anthropic.Tool = {
  name: "submit_questions",
  description:
    "Submit a batch of newly written CCAF practice questions. Each question must follow the contract below precisely.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: [
            "scenario",
            "domains",
            "task_statements",
            "difficulty",
            "correct",
            "stem",
            "options",
            "teaches",
          ],
          properties: {
            scenario: {
              type: "string",
              enum: ALL_SCENARIOS,
            },
            domains: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: { type: "integer", minimum: 1, maximum: 5 },
            },
            task_statements: {
              type: "array",
              minItems: 1,
              items: { type: "string", pattern: "^[1-5]\\.[1-9]$" },
            },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            tags: {
              type: "array",
              items: { type: "string" },
            },
            correct: { type: "string", enum: ["A", "B", "C", "D"] },
            stem: {
              type: "string",
              description:
                "Production scenario describing system, symptom, and decision. 2–6 sentences. No abstract trivia.",
            },
            options: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                required: ["letter", "text", "explanation"],
                properties: {
                  letter: { type: "string", enum: ["A", "B", "C", "D"] },
                  text: { type: "string" },
                  explanation: {
                    type: "string",
                    description:
                      "Why this option is right (for the correct one) or why it specifically fails (for distractors). Name the principle, do not handwave.",
                  },
                },
              },
            },
            teaches: {
              type: "string",
              description:
                "Markdown bullet list of what this question teaches. Cite the specific task statement and any mental model.",
            },
          },
        },
      },
    },
    required: ["questions"],
  },
};

const SYSTEM_INSTRUCTIONS = `You are an expert CCAF (Claude Certified Architect — Foundations) question writer.

You will be given a domain guide and example questions. Your job: produce new high-quality, exam-realistic multiple-choice questions matching the requested scenario, domain, and difficulty.

Hard rules — every question must:
1. Have a stem that names a concrete production situation: a system, a symptom, and a decision the architect must make. No abstract trivia.
2. Have exactly four options labeled A/B/C/D. Distractors must be plausible — a candidate with partial knowledge would consider them. If only the correct option is defensible, the question is too easy.
3. Have an explanation for **every** option (correct AND each distractor). Each explanation names a principle, not a vibe. "B is wrong because it's not the right approach" is forbidden; instead "B fails because system-prompt instructions have a non-zero failure rate; programmatic enforcement provides deterministic guarantees."
4. Cite at least one task statement (e.g., "1.4") that the question maps to. Pull these from the domain guide.
5. Use \`teaches\` to name 1–3 concepts the question reinforces. Bullet list, citing domain.task_statement when relevant.

Difficulty calibration:
- easy: direct recall from the domain guide; one obvious correct answer.
- medium: requires judgement between competing plausible approaches.
- hard: combines two principles, or spots an anti-pattern dressed as a plausible answer.

Avoid:
- Duplicating the angle of an existing question (you'll get a list to avoid).
- Generic options that don't explain why they fail.
- Stems that test trivia rather than architectural decisions.

When you are ready, call the submit_questions tool with all questions in one call.`;

function pickExampleQuestions(domain: number, count = 2): Question[] {
  const all = getApprovedQuestions().filter((q) => q.domains.includes(domain));
  if (all.length === 0) return getApprovedQuestions().slice(0, count);
  return all.slice(0, count);
}

function formatExampleQuestion(q: Question): string {
  const lines: string[] = [];
  lines.push(`### Example: ${q.id} (${q.scenario}, domains ${q.domains.join(", ")}, ${q.difficulty})`);
  lines.push(`Stem: ${q.stem}`);
  for (const opt of q.options) {
    lines.push(`${opt.letter}) ${opt.text}`);
  }
  lines.push(`Correct: ${q.correct}`);
  lines.push("Per-option explanations:");
  for (const opt of q.options) {
    lines.push(`- ${opt.letter}: ${opt.explanation}`);
  }
  lines.push(`Teaches: ${q.teaches.replace(/\n+/g, " ")}`);
  return lines.join("\n");
}

function getDomainGuideText(domain: number): string {
  const slug = `domain/${domain}`;
  const docs = getDocs();
  const guide = docs.find((d) => d.group === "domain" && d.slug.startsWith(slug));
  if (!guide) {
    throw new Error(
      `No domain guide found for domain ${domain}. Expected slug starting with "${slug}".`,
    );
  }
  return guide.body;
}

export type GenerateInput = {
  scenario: Scenario;
  domain: number;
  count: number;
  difficulty?: Difficulty;
  /** Existing question IDs / one-line topics to discourage duplication. */
  avoidTopics?: string[];
};

export type GenerateOutput = {
  batchId: string;
  drafts: GeneratedQuestionDraft[];
  /** Per-question Zod-validation errors (skipped from drafts). */
  rejected: { reason: string; raw: unknown }[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string;
};

export async function generateQuestions(
  input: GenerateInput,
): Promise<GenerateOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic();
  const guide = getDomainGuideText(input.domain);
  const examples = pickExampleQuestions(input.domain, 2)
    .map(formatExampleQuestion)
    .join("\n\n");

  const avoidLine =
    input.avoidTopics && input.avoidTopics.length > 0
      ? `\n\nAvoid duplicating these existing questions or angles:\n${input.avoidTopics.map((t) => `- ${t}`).join("\n")}`
      : "";

  const userPrompt =
    `Generate ${input.count} new ${input.scenario} question${input.count === 1 ? "" : "s"}` +
    ` testing Domain ${input.domain}` +
    (input.difficulty ? ` at ${input.difficulty} difficulty` : "") +
    `. Vary the angle — do not write four near-duplicate questions.` +
    avoidLine;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      {
        type: "text",
        text: `## Domain ${input.domain} guide:\n\n${guide}`,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `## High-quality examples to match in style and rigor:\n\n${examples}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_QUESTIONS_TOOL],
    tool_choice: { type: "tool", name: "submit_questions" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use",
  ) as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) {
    throw new Error(
      `Generator did not return a tool_use block. stop_reason=${response.stop_reason}`,
    );
  }

  const parsedTool = ToolInputSchema.safeParse(toolUse.input);
  if (!parsedTool.success) {
    throw new Error(
      `Generator output failed top-level Zod parse: ${JSON.stringify(parsedTool.error.flatten())}`,
    );
  }

  const drafts: GeneratedQuestionDraft[] = [];
  const rejected: { reason: string; raw: unknown }[] = [];

  for (const raw of parsedTool.data.questions) {
    // Re-parse each so per-question failures show up individually.
    const parsed = GeneratedQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({
        reason: JSON.stringify(parsed.error.flatten()),
        raw,
      });
      continue;
    }

    // Internal sanity: exactly one option marked correct, letters A-D unique.
    const letters = new Set(parsed.data.options.map((o) => o.letter));
    if (letters.size !== 4) {
      rejected.push({
        reason: "options letters not exactly {A,B,C,D}",
        raw,
      });
      continue;
    }
    if (
      !parsed.data.options.find((o) => o.letter === parsed.data.correct)
    ) {
      rejected.push({
        reason: `correct=${parsed.data.correct} but no matching option`,
        raw,
      });
      continue;
    }

    drafts.push(parsed.data);
  }

  const usage = response.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  return {
    batchId: nanoid(10),
    drafts,
    rejected,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    model: MODEL,
  };
}
