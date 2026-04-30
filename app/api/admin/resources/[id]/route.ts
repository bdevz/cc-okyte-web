import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  deleteLearningResource,
  reviewLearningResource,
} from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  decision: z.enum(["approved", "rejected"]),
});

export async function PATCH(
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
  const result = await reviewLearningResource({
    id: params.id,
    reviewerId: session.sub,
    decision: parsed.data.decision,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "Resource not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  await deleteLearningResource(params.id);
  return NextResponse.json({ ok: true });
}
