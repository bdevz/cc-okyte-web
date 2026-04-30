import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { ALL_SCENARIOS } from "@/lib/content";
import { fetchResourceSuggestions } from "@/lib/resource-fetcher";
import { insertLearningResources } from "@/db/queries";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  domain: z.number().int().min(1).max(5),
  taskStatement: z
    .string()
    .regex(/^[1-5]\.[1-9]$/)
    .optional(),
  scenario: z.enum(ALL_SCENARIOS as [string, ...string[]]).optional(),
  keywords: z.string().max(300).optional(),
  count: z.number().int().min(1).max(8).default(4),
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
    result = await fetchResourceSuggestions({
      domain: parsed.data.domain,
      taskStatement: parsed.data.taskStatement,
      scenario: parsed.data.scenario as any,
      keywords: parsed.data.keywords,
      count: parsed.data.count,
    });
  } catch (err) {
    console.error("[resources/fetch] error:", err);
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Fetch failed.",
      },
      { status: 502 },
    );
  }

  const inserted = await insertLearningResources(
    result.drafts.map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description + (d.why_useful ? `\n\nWhy useful: ${d.why_useful}` : ""),
      type: d.type,
      domains: d.domains,
      taskStatements: d.task_statements,
      tags: [],
      status: "pending_review",
      source: "claude-suggested",
      addedBy: session.sub,
    })),
  );

  return NextResponse.json({
    ok: true,
    insertedCount: inserted.length,
    rejectedCount: result.rejected.length,
    rejectedSamples: result.rejected.slice(0, 3),
    usage: {
      input: result.inputTokens,
      output: result.outputTokens,
      cacheRead: result.cacheReadTokens,
      cacheWrite: result.cacheWriteTokens,
      webSearchCalls: result.webSearchCalls,
      model: result.model,
    },
  });
}
