import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession, type SessionClaims } from "./auth";

export async function getSession(): Promise<SessionClaims | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionClaims> {
  const s = await getSession();
  if (!s) {
    throw new Error("Unauthenticated");
  }
  return s;
}
