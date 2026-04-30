import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDocs, getScenarioReadmes } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/MarkdownView";

export const dynamic = "force-dynamic";

export default async function LearnDocPage({
  params,
}: {
  params: { slug: string[] };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const slug = params.slug.join("/");
  const doc = getDocs().find((d) => d.slug === slug);
  const scenario = getScenarioReadmes().find((s) => s.slug === slug);
  const item = doc ?? scenario;
  if (!item) notFound();

  return (
    <article className="space-y-4">
      <Link href="/learn">
        <Button variant="outline" size="sm">
          ← Back to library
        </Button>
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <p className="text-xs text-muted-foreground">
          Source: <code>{item.sourcePath}</code>
        </p>
      </header>
      <div className="rounded-md border border-border bg-white p-6">
        <MarkdownView body={item.body} />
      </div>
    </article>
  );
}
