import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  ALL_DIFFICULTIES,
  ALL_SCENARIOS,
  type Question,
} from "@/lib/content";
import { getRuntimeQuestionPool } from "@/lib/runtime-pool";
import { questionsAttemptedByUser } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  scenario: z.enum(ALL_SCENARIOS as [string, ...string[]]).optional(),
  difficulty: z.enum(ALL_DIFFICULTIES as [string, ...string[]]).optional(),
  domain: z
    .string()
    .regex(/^[1-5]$/)
    .optional(),
  unseen: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Bad filter" }, { status: 400 });
  }
  const { scenario, difficulty, domain, unseen } = parsed.data;

  let pool: Question[] = await getRuntimeQuestionPool();
  if (scenario) pool = pool.filter((q) => q.scenario === scenario);
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
  if (domain) pool = pool.filter((q) => q.domains.includes(Number(domain)));

  if (unseen === "1") {
    const seen = await questionsAttemptedByUser(session.sub);
    const unseenPool = pool.filter((q) => !seen.has(q.id));
    if (unseenPool.length > 0) pool = unseenPool;
    else {
      return new NextResponse(null, { status: 204 });
    }
  }

  if (pool.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return NextResponse.json({ question: pick });
}
