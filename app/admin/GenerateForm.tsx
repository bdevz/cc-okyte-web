"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Difficulty, Scenario } from "@/lib/content";

type Result = {
  ok: boolean;
  batchId?: string;
  insertedIds?: string[];
  rejectedCount?: number;
  rejectedSamples?: { reason: string }[];
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    model: string;
  };
  message?: string;
};

export function GenerateForm({
  scenarios,
  difficulties,
}: {
  scenarios: readonly Scenario[];
  difficulties: readonly Difficulty[];
}) {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>(scenarios[0]);
  const [domain, setDomain] = useState(1);
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty | "any">("any");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenario,
          domain,
          count,
          difficulty: difficulty === "any" ? undefined : difficulty,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Result;
      setResult({ ...data, ok: res.ok && data.ok });
      if (res.ok && data.ok) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Scenario">
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
          >
            {scenarios.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Domain">
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
        </Field>
        <Field label="Difficulty">
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm capitalize"
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as Difficulty | "any")
            }
          >
            <option value="any">Any</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 1);
            }}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Generating…" : `Generate ${count} question${count === 1 ? "" : "s"}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Generation calls Claude with the relevant domain guide cached. ~10–30
          seconds for a batch of {count}.
        </span>
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function ResultPanel({ result }: { result: Result }) {
  if (!result.ok) {
    return (
      <div className="rounded-md border border-destructive bg-red-50 p-3 text-sm text-destructive">
        Generation failed: {result.message ?? "unknown error"}
      </div>
    );
  }
  const u = result.usage;
  return (
    <div className="rounded-md border border-success bg-green-50 p-3 text-sm text-green-900 space-y-1">
      <p>
        <strong>Created {result.insertedIds?.length ?? 0} question(s).</strong>{" "}
        Batch <code>{result.batchId}</code> — review them below.
      </p>
      {result.rejectedCount && result.rejectedCount > 0 ? (
        <p>
          {result.rejectedCount} draft(s) failed validation and were dropped.
        </p>
      ) : null}
      {u ? (
        <p className="text-xs text-muted-foreground">
          Tokens: {u.input} in / {u.output} out · cache read {u.cacheRead}, write{" "}
          {u.cacheWrite} · model {u.model}
        </p>
      ) : null}
    </div>
  );
}
