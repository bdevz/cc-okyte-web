import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { listResourcesForQuestion } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  domains: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5),
    )
    .optional(),
  tasks: z
    .string()
    .transform((s) =>
      s.split(",").filter((x) => /^[1-5]\.[1-9]$/.test(x.trim())),
    )
    .optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    domains: url.searchParams.get("domains") ?? undefined,
    tasks: url.searchParams.get("tasks") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const resources = await listResourcesForQuestion({
    domains: parsed.data.domains ?? [],
    taskStatements: parsed.data.tasks ?? [],
    limit: 3,
  });
  return NextResponse.json({ ok: true, resources });
}
