import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DOMAIN_NAMES: Record<number, string> = {
  1: "Agentic Architecture",
  2: "Tool Design & MCP",
  3: "Claude Code Config",
  4: "Prompt Engineering",
  5: "Context & Reliability",
};

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const data = await getDashboard(session.sub);

  const accuracy =
    data.totalAttempts > 0
      ? Math.round((100 * data.correctAttempts) / data.totalAttempts)
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {session.name}</h1>
          <p className="text-sm text-muted-foreground">
            Pick up where you left off — every answer feeds your progress below.
          </p>
        </div>
        <Link href="/practice">
          <Button size="lg">Take a practice question</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total practice attempts</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {data.totalAttempts}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overall accuracy</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {accuracy}%
            <span className="ml-2 text-sm text-muted-foreground">
              ({data.correctAttempts}/{data.totalAttempts})
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mock exams taken</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {data.recentMocks.length}
            <span className="ml-2 text-sm text-muted-foreground">
              {data.recentMocks.length === 0
                ? "(coming soon)"
                : "(recent shown below)"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accuracy by domain</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byDomain.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attempts yet. Click "Take a practice question" to begin.
            </p>
          ) : (
            <ul className="space-y-2">
              {[1, 2, 3, 4, 5].map((d) => {
                const row = data.byDomain.find((r) => r.domain === d);
                const total = row?.total ?? 0;
                const correct = row?.correct ?? 0;
                const pct =
                  total > 0 ? Math.round((100 * correct) / total) : null;
                return (
                  <li key={d} className="flex items-center gap-3">
                    <span className="w-44 text-sm font-medium">
                      D{d}. {DOMAIN_NAMES[d]}
                    </span>
                    <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${pct ?? 0}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                      {pct === null ? "—" : `${pct}% (${correct}/${total})`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
