import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookie,
  signSession,
  type SessionClaims,
} from "@/lib/auth";
import { verifySharedPassword } from "@/lib/password";
import { getOrCreateUser } from "@/db/queries";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-z][a-z0-9._-]{0,31}$/;

const Body = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((s) => s.toLowerCase())
    .refine((s) => USERNAME_RE.test(s), {
      message:
        "Use 1–32 lowercase letters, numbers, dots, dashes, or underscores; start with a letter.",
    }),
  password: z.string().min(1).max(256),
});

const GENERIC_ERROR = "That username or password isn't valid.";

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/[._-]/g, " ");
}

function isAdmin(username: string): boolean {
  const list = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(username);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Sign-in failed.";
    return NextResponse.json(
      { ok: false, message },
      { status: 400 },
    );
  }
  const { username, password } = parsed.data;

  // Verify password first so attackers can't probe usernames.
  const passwordOk = await verifySharedPassword(password);
  if (!passwordOk) {
    return NextResponse.json(
      { ok: false, message: GENERIC_ERROR },
      { status: 401 },
    );
  }

  const role: SessionClaims["role"] = isAdmin(username) ? "admin" : "user";
  const user = await getOrCreateUser({
    username,
    displayName: titleCase(username),
    role,
  });

  const token = await signSession({
    sub: user.id,
    username: user.username,
    name: user.displayName,
    role: user.role === "admin" ? "admin" : role,
  });

  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", buildSessionCookie(token));
  return res;
}
