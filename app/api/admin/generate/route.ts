import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { ALL_DIFFICULTIES, ALL_SCENARIOS } from "@/lib/content";
import { generateQuestions } from "@/lib/generator";
import {
  insertGeneratedQuestions,
  nextQuestionId,
} from "@/db/queries";

export const runtime = "nodejs";
// Generation can take 30s+ end to end with Anthropic.
export const maxDuration = 120;

const Body = z.object({
  scenario: z.enum(ALL_SCENARIOS as [string, ...string[]]),
  domain: z.number().int().min(1).max(5),
  count: z.number().int().min(1).max(10),
  difficulty: z.enum(ALL_DIFFICULTIES as [string, ...string[]]).optional(),
  avoidTopics: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid request" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await generateQuestions({
      scenario: parsed.data.scenario as any,
      domain: parsed.data.domain,
      count: parsed.data.count,
      difficulty: parsed.data.difficulty as any,
      avoidTopics: parsed.data.avoidTopics,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generation failed.";
    console.error("[generate] error:", err);
    return NextResponse.json(
      { ok: false, message },
      { status: 502 },
    );
  }

  const inserted: string[] = [];
  for (const draft of result.drafts) {
    const id = await nextQuestionId(draft.scenario);
    await insertGeneratedQuestions([
      {
        id,
        scenario: draft.scenario,
        domains: draft.domains,
        taskStatements: draft.task_statements,
        difficulty: draft.difficulty,
        tags: draft.tags ?? [],
        source: "claude-generated",
        correct: draft.correct,
        status: "pending_review",
        stem: draft.stem,
        optionsJson: draft.options.map((o) => ({
          ...o,
          isCorrect: o.letter === draft.correct,
        })),
        teaches: draft.teaches,
        generationModel: result.model,
        generationBatchId: result.batchId,
      },
    ]);
    inserted.push(id);
  }

  return NextResponse.json({
    ok: true,
    batchId: result.batchId,
    insertedIds: inserted,
    rejectedCount: result.rejected.length,
    rejectedSamples: result.rejected.slice(0, 3),
    usage: {
      input: result.inputTokens,
      output: result.outputTokens,
      cacheRead: result.cacheReadTokens,
      cacheWrite: result.cacheWriteTokens,
      model: result.model,
    },
  });
}
