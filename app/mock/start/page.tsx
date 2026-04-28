import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ALL_SCENARIOS, getApprovedQuestions } from "@/lib/content";
import { StartForm } from "./StartForm";

export const dynamic = "force-dynamic";

export default async function MockStartPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pool = getApprovedQuestions();
  const totalApproved = pool.length;
  const perScenario: Record<string, number> = {};
  for (const q of pool) {
    perScenario[q.scenario] = (perScenario[q.scenario] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Start a mock exam</h1>
        <p className="text-sm text-muted-foreground">
          The real CCAF is 60 questions across all five domains. Pick the
          number of questions and (optionally) which scenarios to draw from.
        </p>
      </div>
      <StartForm
        scenarios={ALL_SCENARIOS}
        totalApproved={totalApproved}
        perScenario={perScenario}
      />
    </div>
  );
}
