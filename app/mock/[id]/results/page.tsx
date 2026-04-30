import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMockRun, listResourcesForQuestion } from "@/db/queries";
import { getRuntimeQuestionById } from "@/lib/runtime-pool";
import { RelatedResources } from "@/components/RelatedResources";
import type { ScoreReport } from "@/lib/scorer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const DOMAIN_NAMES: Record<string, string> = {
  "1": "Agentic Architecture",
  "2": "Tool Design & MCP",
  "3": "Claude Code Config",
  "4": "Prompt Engineering",
  "5": "Context & Reliability",
};

export default async function MockResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const run = await getMockRun(params.id, session.sub);
  if (!run) notFound();
  if (run.status !== "submitted") {
    redirect(`/mock/${run.id}`);
  }

  const report = run.reportJson as ScoreReport | null;
  if (!report) {
    return (
      <p className="text-sm text-destructive">
        This exam was submitted but has no scored report. Please contact an admin.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exam results</h1>
        <p className="text-sm text-muted-foreground">
          Run id: <code>{run.id}</code> · Submitted{" "}
          {run.submittedAt
            ? new Date(run.submittedAt).toLocaleString()
            : "—"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Raw score</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {report.rawScore}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scaled estimate</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {report.scaledEstimate}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / 1000
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pass threshold (720)</CardTitle>
          </CardHeader>
          <CardContent
            className={
              "text-3xl font-semibold " +
              (report.passedThreshold720 ? "text-success" : "text-destructive")
            }
          >
            {report.passedThreshold720 ? "Pass" : "Below 720"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per domain</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Domain</th>
                <th className="py-2">Correct</th>
                <th className="py-2">Total</th>
                <th className="py-2">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {(["1", "2", "3", "4", "5"] as const).map((d) => {
                const s = report.perDomain[d];
                return (
                  <tr key={d} className="border-t border-border">
                    <td className="py-2">
                      D{d}. {DOMAIN_NAMES[d]}
                    </td>
                    <td className="py-2 tabular-nums">{s?.correct ?? 0}</td>
                    <td className="py-2 tabular-nums">{s?.total ?? 0}</td>
                    <td className="py-2 tabular-nums">
                      {s?.accuracy === null || s?.accuracy === undefined
                        ? "—"
                        : `${Math.round(100 * s.accuracy)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Scenario</th>
                <th className="py-2">Correct</th>
                <th className="py-2">Total</th>
                <th className="py-2">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.perScenario)
                .sort()
                .map(([scenario, s]) => (
                  <tr key={scenario} className="border-t border-border">
                    <td className="py-2">{scenario}</td>
                    <td className="py-2 tabular-nums">{s.correct}</td>
                    <td className="py-2 tabular-nums">{s.total}</td>
                    <td className="py-2 tabular-nums">
                      {s.accuracy === null
                        ? "—"
                        : `${Math.round(100 * s.accuracy)}%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {report.weakestDomains.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Where to focus next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Your accuracy was lowest on{" "}
              <strong>
                {report.weakestDomains
                  .map((d) => `Domain ${d} (${DOMAIN_NAMES[String(d)]})`)
                  .join(" and ")}
              </strong>
              . Re-read those domain guides and run a few practice questions filtered
              to those domains.
            </p>
            {await Promise.all(
              report.weakestDomains.map(async (d) => {
                const resources = await listResourcesForQuestion({
                  domains: [d],
                  taskStatements: [],
                  limit: 3,
                });
                if (resources.length === 0) return null;
                return (
                  <div key={d}>
                    <RelatedResources
                      resources={resources}
                      title={`Resources for D${d}`}
                    />
                  </div>
                );
              }),
            )}
          </CardContent>
        </Card>
      ) : null}

      {report.incorrect.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Questions to review ({report.incorrect.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {await Promise.all(
                report.incorrect.map(async (row) => {
                  const q = await getRuntimeQuestionById(row.id);
                  return (
                  <li key={row.id} className="flex items-start gap-3">
                    <span className="w-10 tabular-nums text-muted-foreground">
                      Q{row.number}
                    </span>
                    <div className="flex-1">
                      <p>
                        <code>{row.id}</code> — {row.scenario} — domains{" "}
                        {row.domains.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Your answer: <strong>{row.userAnswer ?? "—"}</strong>
                        {" · "}Correct: <strong>{row.correctAnswer}</strong>
                      </p>
                      {q ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Show explanation
                          </summary>
                          <div className="mt-1 rounded border border-border bg-muted/30 p-2 text-xs">
                            {q.options.map((opt) => (
                              <p key={opt.letter} className="mb-1">
                                <strong>{opt.letter})</strong>{" "}
                                {opt.explanation}
                              </p>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </li>
                );
                }),
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-3">
        <Link href="/mock/start">
          <Button>Start another exam</Button>
        </Link>
        <Link href="/practice">
          <Button variant="outline">Practice individual questions</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
