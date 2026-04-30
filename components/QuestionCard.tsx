"use client";
import { useEffect, useState } from "react";
import type { Question, Letter } from "@/lib/content";
import type { LearningResource } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MarkdownView } from "@/components/MarkdownView";
import { RelatedResources } from "@/components/RelatedResources";
import { cn } from "@/lib/utils";

const DOMAIN_LABEL: Record<number, string> = {
  1: "Agentic Architecture",
  2: "Tool Design & MCP",
  3: "Claude Code Config",
  4: "Prompt Engineering",
  5: "Context & Reliability",
};

export function QuestionCard({
  question,
  onLogged,
  onNext,
}: {
  question: Question;
  onLogged?: (correct: boolean) => void;
  onNext?: () => void;
}) {
  const [chosen, setChosen] = useState<Letter | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<LearningResource[] | null>(null);

  const isCorrect = submitted && chosen === question.correct;

  useEffect(() => {
    if (!submitted || isCorrect) return;
    const params = new URLSearchParams();
    params.set("domains", question.domains.join(","));
    if (question.task_statements.length > 0) {
      params.set("tasks", question.task_statements.join(","));
    }
    let cancelled = false;
    fetch(`/api/practice/related?${params}`)
      .then((res) => (res.ok ? res.json() : { resources: [] }))
      .then((data) => {
        if (!cancelled) setRelated(data.resources ?? []);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [submitted, isCorrect, question.domains, question.task_statements]);

  async function submit() {
    if (!chosen) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/attempt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          chosen,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to record your attempt.");
        return;
      }
      setSubmitted(true);
      onLogged?.(chosen === question.correct);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {question.id}
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {question.scenario}
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground capitalize">
            {question.difficulty}
          </span>
          {question.domains.map((d) => (
            <span
              key={d}
              className="rounded-full bg-accent px-2 py-1 text-accent-foreground"
            >
              D{d} · {DOMAIN_LABEL[d]}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <MarkdownView body={question.stem} />

        <fieldset
          className="space-y-2"
          disabled={submitted || submitting}
          aria-label="Answer options"
        >
          {question.options.map((opt) => {
            const selected = chosen === opt.letter;
            const correctness =
              submitted && opt.isCorrect
                ? "correct"
                : submitted && selected && !opt.isCorrect
                  ? "wrong"
                  : null;
            return (
              <label
                key={opt.letter}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                  selected ? "border-primary bg-accent" : "border-border bg-white",
                  correctness === "correct" &&
                    "border-success bg-green-50",
                  correctness === "wrong" &&
                    "border-destructive bg-red-50",
                )}
              >
                <input
                  type="radio"
                  name="answer"
                  className="mt-1"
                  value={opt.letter}
                  checked={selected}
                  onChange={() => setChosen(opt.letter)}
                />
                <div className="flex-1">
                  <div className="font-medium">
                    {opt.letter}) <MarkdownInline text={opt.text} />
                  </div>
                  {submitted ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {opt.explanation}
                    </p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </fieldset>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {!submitted ? (
          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!chosen || submitting}>
              {submitting ? "Submitting..." : "Submit answer"}
            </Button>
            {chosen ? (
              <span className="text-sm text-muted-foreground">
                Selected: {chosen}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                isCorrect
                  ? "border-success bg-green-50 text-green-900"
                  : "border-destructive bg-red-50 text-red-900",
              )}
              role="status"
            >
              {isCorrect
                ? `Correct — ${question.correct} is right.`
                : `Not quite — the correct answer is ${question.correct}.`}
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-4">
              <h3 className="text-sm font-semibold">Why this question matters</h3>
              <MarkdownView body={question.teaches} className="text-sm" />
            </div>

            {!isCorrect && related ? (
              <RelatedResources
                resources={related}
                title="Learn more about this topic"
              />
            ) : null}

            {onNext ? (
              <Button variant="outline" onClick={onNext}>
                Next question
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarkdownInline({ text }: { text: string }) {
  // Strip a single pair of leading/trailing markdown emphasis to keep inline
  // option labels compact. Full markdown rendering is reserved for stems.
  const stripped = text.replace(/^\*\*(.*)\*\*$/, "$1");
  return <span>{stripped}</span>;
}
