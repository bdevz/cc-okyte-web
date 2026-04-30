import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  insertLearningResources,
  listLearningResources,
} from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  title: z.string().trim().min(4).max(200),
  url: z.string().url(),
  description: z.string().max(800).optional(),
  type: z.enum(["video", "doc", "blog", "scenario", "course", "other"]),
  domains: z.array(z.number().int().min(1).max(5)).min(1),
  taskStatements: z.array(z.string().regex(/^[1-5]\.[1-9]$/)).default([]),
  tags: z.array(z.string()).default([]),
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
      { ok: false, message: parsed.error.flatten().formErrors.join(", ") || "Invalid request" },
      { status: 400 },
    );
  }
  const [row] = await insertLearningResources([
    {
      title: parsed.data.title,
      url: parsed.data.url,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      domains: parsed.data.domains,
      taskStatements: parsed.data.taskStatements,
      tags: parsed.data.tags,
      status: "approved",
      source: "admin",
      addedBy: session.sub,
    },
  ]);
  return NextResponse.json({ ok: true, resource: row });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const url = new URL(req.url);
  const status =
    (url.searchParams.get("status") as
      | "pending_review"
      | "approved"
      | "rejected"
      | null) ?? undefined;
  const list = await listLearningResources({ status });
  return NextResponse.json({ ok: true, resources: list });
}
