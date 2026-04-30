import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { reviewGeneratedQuestion } from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
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

  const result = await reviewGeneratedQuestion({
    id: params.id,
    reviewerId: session.sub,
    decision: parsed.data.decision,
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "Question not found or already reviewed." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
