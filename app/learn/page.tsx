import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDocs, getScenarioReadmes } from "@/lib/content";
import { listLearningResources } from "@/db/queries";
import { LearnLibrary } from "./LearnLibrary";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const docs = getDocs();
  const scenarios = getScenarioReadmes();
  const resources = await listLearningResources({ status: "approved" });

  const items = [
    ...docs.map((d) => ({
      kind: "doc" as const,
      slug: d.slug,
      title: d.title,
      description: d.body.slice(0, 200).replace(/[#*`]/g, "").trim(),
      group: d.group,
      url: `/learn/${d.slug}`,
      external: false,
      domains: [] as number[],
      type: d.group,
    })),
    ...scenarios.map((s) => ({
      kind: "scenario" as const,
      slug: s.slug,
      title: s.title,
      description: s.body.slice(0, 200).replace(/[#*`]/g, "").trim(),
      group: "scenario" as const,
      url: `/learn/${s.slug}`,
      external: false,
      domains: [] as number[],
      type: "scenario",
    })),
    ...resources.map((r) => ({
      kind: "resource" as const,
      slug: r.id,
      title: r.title,
      description: r.description ?? "",
      group: r.type,
      url: r.url,
      external: true,
      domains: r.domains,
      type: r.type,
    })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Learn</h1>
        <p className="text-sm text-muted-foreground">
          The full study library: domain guides, cheatsheets, scenario walkthroughs,
          and external resources curated for the team.
        </p>
      </div>
      <LearnLibrary items={items} />
    </div>
  );
}
