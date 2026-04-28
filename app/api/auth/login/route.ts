import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookie,
  signSession,
  type SessionClaims,
} from "@/lib/auth";
import { verifySharedPassword } from "@/lib/password";
import { getUserByUsername } from "@/db/queries";

export const runtime = "nodejs";

const Body = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

const GENERIC_ERROR = "That username or password isn't valid.";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: GENERIC_ERROR },
      { status: 400 },
    );
  }
  const { username, password } = parsed.data;

  const user = await getUserByUsername(username);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: GENERIC_ERROR },
      { status: 401 },
    );
  }

  const passwordOk = await verifySharedPassword(password);
  if (!passwordOk) {
    return NextResponse.json(
      { ok: false, message: GENERIC_ERROR },
      { status: 401 },
    );
  }

  const adminOverrides = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const role: SessionClaims["role"] =
    user.role === "admin" || adminOverrides.includes(user.username.toLowerCase())
      ? "admin"
      : "user";

  const token = await signSession({
    sub: user.id,
    username: user.username,
    name: user.displayName,
    role,
  });

  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", buildSessionCookie(token));
  return res;
}
