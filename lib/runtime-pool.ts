import {
  getApprovedQuestions as getStaticApprovedQuestions,
  getQuestionById as getStaticQuestionById,
  type Question,
} from "./content";
import {
  getGeneratedQuestionById,
  listApprovedGeneratedQuestions,
} from "@/db/queries";

/**
 * The live question pool. Static markdown bank (compiled into
 * @content/questions.json at build) merged with admin-approved generated
 * questions from the DB. Selectors and graders consume this through the
 * same `Question` type.
 *
 * This is per-request work — the DB call is cheap (single SELECT, ~30 rows)
 * and there's no need to memoize given Vercel's serverless lifecycle.
 */
export async function getRuntimeQuestionPool(): Promise<Question[]> {
  const generated = await listApprovedGeneratedQuestions();
  return [...getStaticApprovedQuestions(), ...generated];
}

/**
 * Lookup by ID. Static first (sync, free), then DB.
 */
export async function getRuntimeQuestionById(
  id: string,
): Promise<Question | null> {
  const fromStatic = getStaticQuestionById(id);
  if (fromStatic) return fromStatic;
  return getGeneratedQuestionById(id);
}
