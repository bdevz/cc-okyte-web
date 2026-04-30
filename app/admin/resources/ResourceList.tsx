"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LearningResource } from "@/db/schema";

const TYPE_ICON: Record<string, string> = {
  video: "▶",
  doc: "📄",
  blog: "✎",
  scenario: "🧪",
  course: "🎓",
  other: "·",
};

export function ResourceList({
  items,
  pending,
}: {
  items: LearningResource[];
  pending: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {pending
          ? "Nothing waiting. Use the form above to find some via Claude."
          : "No approved resources yet."}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id}>
          <ResourceCard r={r} pending={pending} />
        </li>
      ))}
    </ul>
  );
}

function ResourceCard({
  r,
  pending,
}: {
  r: LearningResource;
  pending: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function review(decision: "approved" | "rejected") {
    setBusy(true);
    await fetch(`/api/admin/resources/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${r.title}"? This is permanent.`)) return;
    setBusy(true);
    await fetch(`/api/admin/resources/${r.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <article className="rounded-md border border-border bg-white p-3">
      <header className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{TYPE_ICON[r.type] ?? "·"}</span>
        <span className="capitalize">{r.type}</span>
        <span>·</span>
        <span>D{r.domains.join(",") || "—"}</span>
        {r.taskStatements.length > 0 ? (
          <>
            <span>·</span>
            <span>tasks {r.taskStatements.join(", ")}</span>
          </>
        ) : null}
        <span>·</span>
        <span>{r.source === "claude-suggested" ? "Claude-suggested" : "manual"}</span>
      </header>
      <p className="font-medium">
        <a
          href={r.url}
          target="_blank"
          rel="noopener"
          className="text-primary hover:underline"
        >
          {r.title}
        </a>
      </p>
      {r.description ? (
        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
          {r.description}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground break-all">{r.url}</p>
      <div className="mt-2 flex gap-2">
        {pending ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => review("approved")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => review("rejected")}
            >
              Reject
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={remove}
          >
            Delete
          </Button>
        )}
      </div>
    </article>
  );
}
