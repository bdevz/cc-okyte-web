"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario } from "@/lib/content";

type Result = {
  ok: boolean;
  insertedCount?: number;
  rejectedCount?: number;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    webSearchCalls: number;
    model: string;
  };
  message?: string;
};

export function FetchResourcesForm({
  scenarios,
}: {
  scenarios: readonly Scenario[];
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(1);
  const [taskStatement, setTaskStatement] = useState("");
  const [scenario, setScenario] = useState<Scenario | "">("");
  const [keywords, setKeywords] = useState("");
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/resources/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain,
        taskStatement: taskStatement || undefined,
        scenario: scenario || undefined,
        keywords: keywords || undefined,
        count,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setResult({ ...data, ok: res.ok && data.ok });
    setBusy(false);
    if (res.ok && data.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Claude searches the web with{" "}
        <code>web_search</code> (up to 5 calls) and submits real URLs of
        relevant tutorials, docs, and videos. Results land in pending review
        below.
      </p>
      <div className="grid gap-3 md:grid-cols-5">
        <div className="space-y-1">
          <Label>Domain</Label>
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={domain}
            onChange={(e) => setDomain(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                D{d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Task (optional)</Label>
          <Input
            value={taskStatement}
            onChange={(e) => setTaskStatement(e.target.value)}
            placeholder="e.g. 1.4"
          />
        </div>
        <div className="space-y-1">
          <Label>Scenario (optional)</Label>
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario | "")}
          >
            <option value="">any</option>
            {scenarios.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 md:col-span-1">
          <Label>Count</Label>
          <Input
            type="number"
            min={1}
            max={8}
            value={count}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(Number.isFinite(n) ? Math.max(1, Math.min(8, n)) : 1);
            }}
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <Label>Keywords (optional)</Label>
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. slash commands"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Searching the web…" : "Find resources"}
        </Button>
        <span className="text-xs text-muted-foreground">
          ~30–60 seconds. Each call uses up to 5 web searches.
        </span>
      </div>
      {result ? <ResultPanel result={result} /> : null}
    </form>
  );
}

function ResultPanel({ result }: { result: Result }) {
  if (!result.ok) {
    return (
      <div className="rounded-md border border-destructive bg-red-50 p-3 text-sm text-destructive">
        {result.message ?? "Fetch failed."}
      </div>
    );
  }
  const u = result.usage;
  return (
    <div className="rounded-md border border-success bg-green-50 p-3 text-sm text-green-900 space-y-1">
      <p>
        Found <strong>{result.insertedCount ?? 0}</strong> resources. Review
        them below.
      </p>
      {result.rejectedCount && result.rejectedCount > 0 ? (
        <p>{result.rejectedCount} draft(s) failed validation.</p>
      ) : null}
      {u ? (
        <p className="text-xs text-muted-foreground">
          Web searches: {u.webSearchCalls} · tokens {u.input}/{u.output} · cache{" "}
          {u.cacheRead}/{u.cacheWrite} · model {u.model}
        </p>
      ) : null}
    </div>
  );
}
