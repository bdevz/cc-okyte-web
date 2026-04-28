import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getQuestionById } from "@/lib/content";
import { recordPracticeAttempt } from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  questionId: z.string().regex(/^q-(cs|cg|mar|dp|cicd|sde)-[0-9]{3}$/),
  chosen: z.enum(["A", "B", "C", "D"]),
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
  const { questionId, chosen } = parsed.data;

  const question = getQuestionById(questionId);
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "Unknown question" },
      { status: 404 },
    );
  }

  const isCorrect = chosen === question.correct;
  await recordPracticeAttempt({
    userId: session.sub,
    questionId: question.id,
    chosen,
    isCorrect,
    domains: question.domains,
    scenario: question.scenario,
  });

  return NextResponse.json({
    ok: true,
    isCorrect,
    correct: question.correct,
  });
}
