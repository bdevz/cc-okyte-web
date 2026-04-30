import type { LearningResource } from "@/db/schema";

const TYPE_ICON: Record<string, string> = {
  video: "▶",
  doc: "📄",
  blog: "✎",
  scenario: "🧪",
  course: "🎓",
  other: "·",
};

export function RelatedResources({
  resources,
  title = "Learn more",
  emptyHint,
}: {
  resources: LearningResource[];
  title?: string;
  emptyHint?: string;
}) {
  if (resources.length === 0) {
    return emptyHint ? (
      <p className="text-xs text-muted-foreground">{emptyHint}</p>
    ) : null;
  }
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="grid gap-2 md:grid-cols-2">
        {resources.map((r) => (
          <li key={r.id}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener"
              className="block rounded-md border border-border bg-white p-3 transition-colors hover:border-primary"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden>{TYPE_ICON[r.type] ?? "·"}</span>
                <span className="capitalize">{r.type}</span>
                <span>·</span>
                <span>D{r.domains.join(",") || "—"}</span>
              </div>
              <p className="font-medium leading-snug">{r.title}</p>
              {r.description ? (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                  {r.description}
                </p>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
