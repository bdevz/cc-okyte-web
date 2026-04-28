"use client";
import { useCallback, useEffect, useState } from "react";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  Difficulty,
  Question,
  Scenario,
} from "@/lib/content";

type Filters = {
  scenario: Scenario | "any";
  difficulty: Difficulty | "any";
  domain: number | "any";
  unseen: boolean;
};

const DEFAULT_FILTERS: Filters = {
  scenario: "any",
  difficulty: "any",
  domain: "any",
  unseen: true,
};

export function PracticeRunner({
  scenarios,
  difficulties,
}: {
  scenarios: readonly Scenario[];
  difficulties: readonly Difficulty[];
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExhausted(false);
    try {
      const params = new URLSearchParams();
      if (filters.scenario !== "any") params.set("scenario", filters.scenario);
      if (filters.difficulty !== "any")
        params.set("difficulty", filters.difficulty);
      if (filters.domain !== "any") params.set("domain", String(filters.domain));
      if (filters.unseen) params.set("unseen", "1");
      const res = await fetch(`/api/practice/random?${params}`);
      if (res.status === 204) {
        setQuestion(null);
        setExhausted(true);
        return;
      }
      if (!res.ok) {
        setError("Could not load a question.");
        return;
      }
      const data = (await res.json()) as { question: Question };
      setQuestion(data.question);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Field label="Scenario">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={filters.scenario}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  scenario: e.target.value as Scenario | "any",
                }))
              }
            >
              <option value="any">Any</option>
              {scenarios.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm capitalize"
              value={filters.difficulty}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  difficulty: e.target.value as Difficulty | "any",
                }))
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
          <Field label="Domain">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={String(filters.domain)}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  domain:
                    e.target.value === "any" ? "any" : Number(e.target.value),
                }))
              }
            >
              <option value="any">Any</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  D{d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Show me">
            <label className="flex items-center gap-2 text-sm h-10">
              <input
                type="checkbox"
                checked={filters.unseen}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, unseen: e.target.checked }))
                }
              />
              Only questions I haven't seen
            </label>
          </Field>
        </CardContent>
      </Card>

      {loading && !question ? (
        <p className="text-sm text-muted-foreground">Loading a question…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {exhausted ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-center">
            <p className="text-base">
              You've seen every question matching these filters.
            </p>
            <p className="text-sm text-muted-foreground">
              Loosen the filters or come back after the bank grows.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setFilters((f) => ({ ...f, unseen: false }))}
              >
                Allow already-seen questions
              </Button>
              <Button onClick={loadNext}>Try again</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {question ? (
        <QuestionCard
          key={question.id}
          question={question}
          onNext={loadNext}
        />
      ) : null}
    </div>
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
