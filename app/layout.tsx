import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCAF Study — cc.okyte.com",
  description:
    "Practice questions and mock exams for the Claude Certified Architect — Foundations exam.",
};

async function NavBar() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  return (
    <header className="border-b border-border bg-white">
      <div className="container flex items-center justify-between py-3">
        <Link href="/" className="font-semibold text-lg">
          CCAF Study
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/practice" className="hover:underline">
            Practice
          </Link>
          <Link href="/mock/start" className="hover:underline">
            Mock exam
          </Link>
          <Link href="/learn" className="hover:underline">
            Learn
          </Link>
          {session.role === "admin" ? (
            <Link href="/admin" className="hover:underline text-muted-foreground">
              Admin
            </Link>
          ) : null}
          <span className="text-muted-foreground">Hi, {session.name}</span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="container py-8">{children}</main>
      </body>
    </html>
  );
}
