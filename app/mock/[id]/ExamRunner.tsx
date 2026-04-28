"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Letter, Question } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type AnswersMap = Record<string, Letter>;
type SaveState = "idle" | "saving" | "saved" | "error";

export function ExamRunner({
  runId,
  questions,
  initialAnswers,
  startedAt,
}: {
  runId: string;
  questions: Question[];
  initialAnswers: Record<string, string>;
  startedAt: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswersMap>(() => {
    const out: AnswersMap = {};
    for (const [k, v] of Object.entries(initialAnswers)) {
      if (v === "A" || v === "B" || v === "C" || v === "D") out[k] = v;
    }
    return out;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const pageQuestions = useMemo(
    () =>
      questions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [questions, page],
  );
  const isLastPage = page === totalPages - 1;
  const answeredCount = Object.keys(answers).length;
  const startedTime = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [elapsed, setElapsed] = useState(() => Date.now() - startedTime);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startedTime), 1000);
    return () => clearInterval(t);
  }, [startedTime]);

  // Block accidental tab close while in progress.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const onPick = useCallback(
    async (qid: string, letter: Letter) => {
      setAnswers((prev) => ({ ...prev, [qid]: letter }));
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch(`/api/mock/${runId}/answer`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId: qid, chosen: letter }),
        });
        if (!res.ok) {
          setSaveState("error");
          setSaveError("Could not save your answer. Try clicking it again.");
          return;
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setSaveError("Network error while saving.");
      }
    },
    [runId],
  );

  async function onSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mock/${runId}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        setSubmitting(false);
        setSaveError("Could not submit the exam.");
        return;
      }
      // Allow leaving without the beforeunload confirm now.
      window.removeEventListener("beforeunload", () => {});
      router.replace(`/mock/${runId}/results`);
    } finally {
      // (router.replace will unmount; submitting state doesn't matter after.)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">
            Mock exam — page {page + 1} of {totalPages}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Answered {answeredCount} / {questions.length}
            </span>
            <span>Time: {fmtDuration(elapsed)}</span>
            <SaveBadge state={saveState} error={saveError} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <ol className="space-y-4" start={page * PAGE_SIZE + 1}>
        {pageQuestions.map((q, idx) => {
          const number = page * PAGE_SIZE + idx + 1;
          return (
            <li key={q.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Question {number}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {q.id}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MarkdownView body={q.stem} />
                  <fieldset className="space-y-2" aria-label={`Question ${number}`}>
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt.letter;
                      return (
                        <label
                          key={opt.letter}
                          className={cn(
                            "flex items-start gap-3 rounded-md border p-2 cursor-pointer text-sm",
                            selected
                              ? "border-primary bg-accent"
                              : "border-border bg-white",
                          )}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="mt-1"
                            value={opt.letter}
                            checked={selected}
                            onChange={() => onPick(q.id, opt.letter)}
                          />
                          <span className="flex-1">
                            <strong>{opt.letter})</strong>{" "}
                            {opt.text.replace(/^\*\*(.*)\*\*$/, "$1")}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => {
            setPage((p) => Math.max(0, p - 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Previous page
        </Button>
        <span className="text-sm text-muted-foreground">
          {answeredCount === questions.length
            ? "All questions answered."
            : `${questions.length - answeredCount} unanswered.`}
        </span>
        {isLastPage ? (
          <Button
            onClick={() => setShowConfirmSubmit(true)}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
        ) : (
          <Button
            onClick={() => {
              setPage((p) => Math.min(totalPages - 1, p + 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Next page
          </Button>
        )}
      </div>

      {showConfirmSubmit ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Submit this exam?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                You answered <strong>{answeredCount}</strong> of{" "}
                <strong>{questions.length}</strong> questions.
                {answeredCount < questions.length
                  ? " Unanswered questions count as incorrect."
                  : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Once submitted, the exam is locked and you can review your results.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmSubmit(false)}
                  disabled={submitting}
                >
                  Keep working
                </Button>
                <Button onClick={onSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Yes, submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function fmtDuration(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function SaveBadge({
  state,
  error,
}: {
  state: SaveState;
  error: string | null;
}) {
  if (state === "saving") {
    return <span className="text-warning">Saving…</span>;
  }
  if (state === "saved") {
    return <span className="text-success">Saved</span>;
  }
  if (state === "error") {
    return <span className="text-destructive">{error ?? "Save failed"}</span>;
  }
  return null;
}
