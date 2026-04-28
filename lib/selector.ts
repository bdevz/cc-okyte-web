/**
 * Deterministic, domain-weighted mock-exam sampler.
 *
 * Faithful port of practice/tools/render_mock.py's `sample()` and `gather()`.
 * The Python tool is the canonical implementation; if behavior diverges, the
 * Python tool wins and this file should be updated.
 */
import type { Question, Scenario } from "./content";
import { mulberry32, shuffleInPlace } from "./rng";

export const DOMAIN_WEIGHTS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.27,
  2: 0.18,
  3: 0.2,
  4: 0.2,
  5: 0.15,
};

export type SelectorInput = {
  pool: readonly Question[];
  count: number;
  scenarios?: readonly Scenario[];
  seed: number;
};

export type SelectorResult = {
  picks: Question[];
  seed: number;
  /** True if the eligible pool was smaller than the requested count. */
  exhausted: boolean;
  /** How many questions were eligible after filtering. */
  eligibleCount: number;
};

function rngSample<T>(pool: readonly T[], n: number, rng: () => number): T[] {
  const copy = pool.slice();
  shuffleInPlace(copy, rng);
  return copy.slice(0, n);
}

export function selectMockQuestions(input: SelectorInput): SelectorResult {
  const rng = mulberry32(input.seed);

  // Match render_mock.py's gather(): only approved, optionally filtered by scenarios.
  let eligible = input.pool.filter((q) => q.review_status === "approved");
  if (input.scenarios && input.scenarios.length > 0) {
    const allow = new Set<string>(input.scenarios);
    eligible = eligible.filter((q) => allow.has(q.scenario));
  }

  const eligibleCount = eligible.length;

  // If pool < requested, render_mock.py downsizes the request to the pool size
  // and emits a WARN. Mirror that behavior; the caller surfaces a notice to the user.
  let count = Math.min(input.count, eligibleCount);
  const exhausted = count < input.count;
  if (count <= 0) {
    return { picks: [], seed: input.seed, exhausted, eligibleCount };
  }

  // Bucket each question by its FIRST listed domain (matches Python).
  const buckets = new Map<number, Question[]>();
  for (const q of eligible) {
    const d = (q.domains[0] ?? 1) as number;
    const bucket = buckets.get(d);
    if (bucket) bucket.push(q);
    else buckets.set(d, [q]);
  }

  // target[d] = round(count * weight[d]); shift drift onto D1 like Python.
  const target: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of [1, 2, 3, 4, 5] as const) {
    target[d] = Math.round(count * DOMAIN_WEIGHTS[d]);
  }
  const drift = count - (target[1] + target[2] + target[3] + target[4] + target[5]);
  if (drift !== 0) target[1] += drift;

  const picks: Question[] = [];
  const picksSet = new Set<string>();

  for (const d of [1, 2, 3, 4, 5] as const) {
    const pool = buckets.get(d) ?? [];
    if (pool.length === 0) continue;
    const n = target[d];
    if (n <= 0) continue;
    if (n <= pool.length) {
      const sampled = rngSample(pool, n, rng);
      for (const q of sampled) {
        picks.push(q);
        picksSet.add(q.id);
      }
    } else {
      // Bucket too small for its weighted target; take everything we have.
      for (const q of pool) {
        picks.push(q);
        picksSet.add(q.id);
      }
    }
  }

  // Top up if drift / under-coverage left us short.
  if (picks.length < count) {
    const leftover = eligible.filter((q) => !picksSet.has(q.id));
    shuffleInPlace(leftover, rng);
    for (const q of leftover) {
      if (picks.length >= count) break;
      picks.push(q);
      picksSet.add(q.id);
    }
  }

  // Trim if overshoot, then final shuffle for delivery order.
  const trimmed = picks.slice(0, count);
  shuffleInPlace(trimmed, rng);
  return { picks: trimmed, seed: input.seed, exhausted, eligibleCount };
}
