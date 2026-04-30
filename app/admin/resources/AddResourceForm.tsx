"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPES = ["video", "doc", "blog", "scenario", "course", "other"] as const;

export function AddResourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("doc");
  const [domains, setDomains] = useState<Set<number>>(new Set());
  const [taskInput, setTaskInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function toggleDomain(d: number) {
    setDomains((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const tasks = taskInput
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^[1-5]\.[1-9]$/.test(s));
    const res = await fetch("/api/admin/resources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        url,
        description: description || undefined,
        type,
        domains: Array.from(domains),
        taskStatements: tasks,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) {
      setMsg({ kind: "ok", text: "Saved." });
      setTitle("");
      setUrl("");
      setDescription("");
      setDomains(new Set());
      setTaskInput("");
      router.refresh();
    } else {
      setMsg({ kind: "err", text: data?.message ?? "Could not save." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Title</Label>
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Anthropic Cookbook: Tool use basics"
          />
        </div>
        <div className="space-y-1">
          <Label>URL</Label>
          <Input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Description (optional)</Label>
        <textarea
          className="w-full rounded-md border border-border bg-white p-2 text-sm"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="1–2 sentences on what this teaches and when to use it."
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label>Type</Label>
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm capitalize"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Domains</Label>
          <div className="flex flex-wrap gap-2 py-2">
            {[1, 2, 3, 4, 5].map((d) => (
              <label
                key={d}
                className="flex items-center gap-1 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={domains.has(d)}
                  onChange={() => toggleDomain(d)}
                />
                D{d}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Task statements (e.g. 1.4, 3.2)</Label>
          <Input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || domains.size === 0}>
          {busy ? "Saving…" : "Add resource"}
        </Button>
        {msg ? (
          <span
            className={
              msg.kind === "ok"
                ? "text-sm text-success"
                : "text-sm text-destructive"
            }
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
