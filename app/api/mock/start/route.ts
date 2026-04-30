import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/session";
import { ALL_SCENARIOS } from "@/lib/content";
import { getRuntimeQuestionPool } from "@/lib/runtime-pool";
import { selectMockQuestions } from "@/lib/selector";
import { createMockRun } from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  count: z.number().int().min(1).max(120).optional(),
  scenarios: z
    .array(z.enum(ALL_SCENARIOS as [string, ...string[]]))
    .max(6)
    .optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid request" },
      { status: 400 },
    );
  }

  const requestedCount = parsed.data.count ?? 60;
  const scenarios = parsed.data.scenarios ?? [];
  const seed = Math.floor(Math.random() * 0xffffffff);

  const pool = await getRuntimeQuestionPool();
  const result = selectMockQuestions({
    pool,
    count: requestedCount,
    scenarios: scenarios as any,
    seed,
  });

  if (result.picks.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "No approved questions match those filters yet.",
      },
      { status: 400 },
    );
  }

  const id = nanoid(12);
  await createMockRun({
    id,
    userId: session.sub,
    count: result.picks.length,
    scenarios,
    seed,
    questionIds: result.picks.map((q) => q.id),
  });

  return NextResponse.json({
    ok: true,
    runId: id,
    count: result.picks.length,
    requestedCount,
    eligibleCount: result.eligibleCount,
    exhausted: result.exhausted,
  });
}
