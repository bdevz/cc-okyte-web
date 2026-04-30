import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { type Letter } from "@/lib/content";
import { getRuntimeQuestionById } from "@/lib/runtime-pool";
import { scoreMock } from "@/lib/scorer";
import { getMockRun, submitMockRun } from "@/db/queries";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const run = await getMockRun(params.id, session.sub);
  if (!run) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (run.status === "submitted") {
    return NextResponse.json(
      { ok: true, runId: run.id, alreadySubmitted: true },
      { status: 200 },
    );
  }

  const questions = await Promise.all(
    run.questionIds.map(async (id) => {
      const q = await getRuntimeQuestionById(id);
      if (!q) {
        throw new Error(`Mock run ${run.id} references unknown question ${id}`);
      }
      return q;
    }),
  );

  const answers: (Letter | null)[] = questions.map((q) => {
    const a = run.answers[q.id];
    return a === "A" || a === "B" || a === "C" || a === "D" ? a : null;
  });

  const report = scoreMock({ questions, answers });

  await submitMockRun({
    runId: run.id,
    userId: session.sub,
    reportJson: report,
    rawCorrect: report.correct,
    scaled: report.scaledEstimate,
    passed: report.passedThreshold720,
  });

  return NextResponse.json({ ok: true, runId: run.id });
}
