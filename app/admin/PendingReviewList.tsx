"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GeneratedQuestion } from "@/db/schema";

type Decision = "approved" | "rejected" | null;

type ReviewState = {
  busy: boolean;
  decision: Decision;
  rejectionReason: string;
  showRejectInput: boolean;
};

const initialState: ReviewState = {
  busy: false,
  decision: null,
  rejectionReason: "",
  showRejectInput: false,
};

export function PendingReviewList({ items }: { items: GeneratedQuestion[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No questions awaiting review. Generate some above.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((q) => (
        <li key={q.id}>
          <ReviewCard q={q} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ q }: { q: GeneratedQuestion }) {
  const router = useRouter();
  const [state, setState] = useState<ReviewState>(initialState);

  async function decide(decision: "approved" | "rejected") {
    if (decision === "rejected" && !state.showRejectInput) {
      setState((s) => ({ ...s, showRejectInput: true }));
      return;
    }
    setState((s) => ({ ...s, busy: true }));
    const res = await fetch(`/api/admin/review/${q.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision,
        reason: decision === "rejected" ? state.rejectionReason : undefined,
      }),
    });
    if (res.ok) {
      setState((s) => ({ ...s, busy: false, decision }));
      router.refresh();
    } else {
      setState((s) => ({ ...s, busy: false }));
    }
  }

  const opts =
    Array.isArray(q.optionsJson)
      ? (q.optionsJson as Array<{
          letter: "A" | "B" | "C" | "D";
          text: string;
          explanation: string;
          isCorrect?: boolean;
        }>)
      : [];

  return (
    <article className="rounded-md border border-border bg-white p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <code className="rounded bg-muted px-2 py-1">{q.id}</code>
        <span>{q.scenario}</span>
        <span>D{q.domains.join(",")}</span>
        <span className="capitalize">{q.difficulty}</span>
        <span>tasks {q.taskStatements.join(", ")}</span>
      </header>
      <p className="mb-3 text-sm">{q.stem}</p>
      <ol className="mb-3 space-y-1 text-sm">
        {opts.map((o) => (
          <li
            key={o.letter}
            className={cn(
              "rounded border border-border p-2",
              o.letter === q.correct ? "bg-green-50" : "bg-white",
            )}
          >
            <p>
              <strong>{o.letter})</strong> {o.text}
              {o.letter === q.correct ? (
                <span className="ml-2 text-xs text-success">CORRECT</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{o.explanation}</p>
          </li>
        ))}
      </ol>
      <details className="mb-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Show "teaches"
        </summary>
        <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
          {q.teaches}
        </pre>
      </details>

      {state.decision ? (
        <p className="text-sm text-muted-foreground">
          Marked <strong>{state.decision}</strong>. Refresh to update list.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={state.busy}
            onClick={() => decide("approved")}
          >
            {state.busy ? "Saving…" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={state.busy}
            onClick={() => decide("rejected")}
          >
            {state.showRejectInput ? "Confirm reject" : "Reject"}
          </Button>
          {state.showRejectInput ? (
            <input
              type="text"
              className="h-9 flex-1 rounded-md border border-border px-3 text-sm"
              placeholder="Reason (optional)"
              value={state.rejectionReason}
              onChange={(e) =>
                setState((s) => ({ ...s, rejectionReason: e.target.value }))
              }
            />
          ) : null}
        </div>
      )}
    </article>
  );
}
