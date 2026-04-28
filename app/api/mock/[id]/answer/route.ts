import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { saveMockAnswer } from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  questionId: z.string().regex(/^q-(cs|cg|mar|dp|cicd|sde)-[0-9]{3}$/),
  chosen: z.enum(["A", "B", "C", "D"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
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

  const result = await saveMockAnswer({
    runId: params.id,
    userId: session.sub,
    questionId: parsed.data.questionId,
    chosen: parsed.data.chosen,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "This exam is already submitted or not yours." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
