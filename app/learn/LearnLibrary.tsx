"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Item = {
  kind: "doc" | "scenario" | "resource";
  slug: string;
  title: string;
  description: string;
  group: string;
  url: string;
  external: boolean;
  domains: number[];
  type: string;
};

const GROUP_LABEL: Record<string, string> = {
  intro: "Intro",
  domain: "Domain guides",
  cheatsheet: "Cheatsheets",
  scenario: "Scenario walkthroughs",
  video: "Videos",
  doc: "Docs",
  blog: "Blog posts",
  course: "Courses",
  other: "Other resources",
};

const GROUP_ORDER = [
  "intro",
  "domain",
  "cheatsheet",
  "scenario",
  "video",
  "course",
  "doc",
  "blog",
  "other",
];

const TYPE_ICON: Record<string, string> = {
  intro: "📘",
  domain: "📘",
  cheatsheet: "📋",
  scenario: "🧪",
  video: "▶",
  doc: "📄",
  blog: "✎",
  course: "🎓",
  other: "·",
};

export function LearnLibrary({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q),
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-white p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides, cheatsheets, scenarios, resources…"
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches for &ldquo;{query}&rdquo;.
        </p>
      ) : (
        grouped.map(({ group, items }) => (
          <section key={group} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUP_LABEL[group] ?? group}
            </h2>
            <ul className="grid gap-2 md:grid-cols-2">
              {items.map((item) => (
                <li key={`${item.kind}:${item.slug}`}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const inner = (
    <div className="block rounded-md border border-border bg-white p-3 transition-colors hover:border-primary">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden>{TYPE_ICON[item.type] ?? "·"}</span>
        <span className="capitalize">{item.type}</span>
        {item.external ? <span className="text-xs">↗</span> : null}
        {item.domains.length > 0 ? (
          <>
            <span>·</span>
            <span>D{item.domains.join(",")}</span>
          </>
        ) : null}
      </div>
      <p className="font-medium leading-snug">{item.title}</p>
      {item.description ? (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
          {item.description}
        </p>
      ) : null}
    </div>
  );

  if (item.external) {
    return (
      <a href={item.url} target="_blank" rel="noopener" className="block">
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.url} className={cn("block")}>
      {inner}
    </Link>
  );
}
