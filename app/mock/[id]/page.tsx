import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMockRun } from "@/db/queries";
import { getQuestionById, type Question } from "@/lib/content";
import { ExamRunner } from "./ExamRunner";

export const dynamic = "force-dynamic";

export default async function MockRunPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const run = await getMockRun(params.id, session.sub);
  if (!run) notFound();

  if (run.status === "submitted") {
    redirect(`/mock/${run.id}/results`);
  }

  // Materialize the run's question list at render time. Build fails if any
  // referenced question went missing, which is the right blast radius — the
  // exam mid-flight should never silently degrade.
  const questions: Question[] = run.questionIds.map((id) => {
    const q = getQuestionById(id);
    if (!q) {
      throw new Error(
        `Mock run ${run.id} references unknown question ${id}; rebuild the content bundle.`,
      );
    }
    return q;
  });

  const startedAt = new Date(run.startedAt);

  return (
    <ExamRunner
      runId={run.id}
      questions={questions}
      initialAnswers={run.answers}
      startedAt={startedAt.toISOString()}
    />
  );
}
