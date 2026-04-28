import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PracticeRunner } from "./PracticeRunner";
import { ALL_DIFFICULTIES, ALL_SCENARIOS } from "@/lib/content";

export default async function PracticePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Practice</h1>
        <p className="text-sm text-muted-foreground">
          One random question at a time. After you submit you'll see why every option
          is right or wrong — that's the part that builds your intuition.
        </p>
      </div>
      <PracticeRunner
        scenarios={ALL_SCENARIOS}
        difficulties={ALL_DIFFICULTIES}
      />
    </div>
  );
}
