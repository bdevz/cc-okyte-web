"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Scenario } from "@/lib/content";

export function StartForm({
  scenarios,
  totalApproved,
  perScenario,
}: {
  scenarios: readonly Scenario[];
  totalApproved: number;
  perScenario: Record<string, number>;
}) {
  const router = useRouter();
  const [count, setCount] = useState(Math.min(60, totalApproved));
  const [picked, setPicked] = useState<Set<Scenario>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleEstimate = useMemo(() => {
    if (picked.size === 0) return totalApproved;
    let n = 0;
    for (const s of picked) n += perScenario[s] ?? 0;
    return n;
  }, [picked, perScenario, totalApproved]);

  const willCap = count > eligibleEstimate;

  function toggleScenario(s: Scenario) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function onStart() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mock/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          count,
          scenarios: Array.from(picked),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Could not start the exam.");
        return;
      }
      const data = (await res.json()) as { runId: string };
      router.push(`/mock/${data.runId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question count</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="count">Number of questions</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={120}
              value={count}
              onChange={(e) => {
                const next = Number(e.target.value);
                setCount(Number.isFinite(next) ? next : 1);
              }}
              className="w-32"
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            {totalApproved} approved questions in the bank today.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenarios (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Leave empty to draw from all six scenarios with the real exam
            domain weighting.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {scenarios.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 rounded-md border border-border bg-white p-2 text-sm cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={picked.has(s)}
                  onChange={() => toggleScenario(s)}
                />
                <span className="flex-1">{s}</span>
                <span className="text-xs text-muted-foreground">
                  {perScenario[s] ?? 0} Q
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {willCap ? (
        <p className="text-sm text-warning">
          Only {eligibleEstimate} questions match those scenarios — the exam
          will use all of them.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button onClick={onStart} disabled={submitting || count < 1} size="lg">
          {submitting ? "Starting…" : "Start exam"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
