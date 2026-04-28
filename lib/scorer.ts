/**
 * Deterministic scorer for a completed mock-exam run.
 *
 * Faithful port of practice/tools/score_mock.py. Each question is counted
 * under EVERY domain in its `domains[]` array (multi-domain questions
 * accumulate to all listed domains). Missing answers count as incorrect.
 */
import type { Question, Letter } from "./content";

export const PASS_THRESHOLD_SCALED = 720;

export type IncorrectEntry = {
  number: number;
  id: string;
  scenario: string;
  domains: number[];
  userAnswer: Letter | null;
  correctAnswer: Letter;
  sourcePath: string;
};

export type DomainStats = {
  correct: number;
  total: number;
  /** null when total is 0 — mirrors the Python report. */
  accuracy: number | null;
};

export type ScoreReport = {
  total: number;
  correct: number;
  rawScore: string;
  scaledEstimate: number;
  passedThreshold720: boolean;
  perDomain: Record<string, DomainStats>;
  perScenario: Record<string, DomainStats>;
  incorrect: IncorrectEntry[];
  weakestDomains: number[];
};

export type ScoreInput = {
  /** Questions in the order they were presented. */
  questions: readonly Question[];
  /** answers[i] is the letter the user chose for `questions[i]`, or null. */
  answers: readonly (Letter | null)[];
};

function bumpDomain(
  acc: Record<string, DomainStats>,
  domain: number,
  correct: boolean,
) {
  const key = String(domain);
  const cur = acc[key] ?? { correct: 0, total: 0, accuracy: null };
  cur.total += 1;
  if (correct) cur.correct += 1;
  cur.accuracy = cur.total === 0 ? null : cur.correct / cur.total;
  acc[key] = cur;
}

function bumpScenario(
  acc: Record<string, DomainStats>,
  scenario: string,
  correct: boolean,
) {
  const cur = acc[scenario] ?? { correct: 0, total: 0, accuracy: null };
  cur.total += 1;
  if (correct) cur.correct += 1;
  cur.accuracy = cur.total === 0 ? null : cur.correct / cur.total;
  acc[scenario] = cur;
}

export function scoreMock(input: ScoreInput): ScoreReport {
  if (input.questions.length !== input.answers.length) {
    throw new Error(
      `scoreMock: questions (${input.questions.length}) and answers (${input.answers.length}) length mismatch`,
    );
  }

  const total = input.questions.length;
  let correctCount = 0;
  const perDomain: Record<string, DomainStats> = {};
  const perScenario: Record<string, DomainStats> = {};
  const incorrect: IncorrectEntry[] = [];

  for (let i = 0; i < total; i++) {
    const q = input.questions[i];
    const userAnswer = input.answers[i];
    const isCorrect = userAnswer !== null && userAnswer === q.correct;
    if (isCorrect) correctCount += 1;

    for (const d of q.domains) {
      bumpDomain(perDomain, d, isCorrect);
    }
    bumpScenario(perScenario, q.scenario, isCorrect);

    if (!isCorrect) {
      incorrect.push({
        number: i + 1,
        id: q.id,
        scenario: q.scenario,
        domains: q.domains,
        userAnswer: userAnswer,
        correctAnswer: q.correct,
        sourcePath: q.sourcePath,
      });
    }
  }

  const scaledEstimate = total > 0 ? Math.round((1000 * correctCount) / total) : 0;
  const passed = scaledEstimate >= PASS_THRESHOLD_SCALED;

  // Weakest 2 domains: only domains with at least one wrong answer count as
  // "weak" (calling a perfect domain weak would be confusing UX). Sort by
  // ascending accuracy, tie-break on larger total (more evidence).
  const weakestDomains = Object.entries(perDomain)
    .filter(([, s]) => s.total > 0 && s.accuracy !== null && s.accuracy < 1)
    .sort((a, b) => {
      const aAcc = a[1].accuracy ?? 1;
      const bAcc = b[1].accuracy ?? 1;
      if (aAcc !== bAcc) return aAcc - bAcc;
      return b[1].total - a[1].total;
    })
    .slice(0, 2)
    .map(([d]) => Number(d));

  return {
    total,
    correct: correctCount,
    rawScore: `${correctCount}/${total}`,
    scaledEstimate,
    passedThreshold720: passed,
    perDomain,
    perScenario,
    incorrect,
    weakestDomains,
  };
}
