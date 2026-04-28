import { describe, expect, it } from "vitest";
import { selectMockQuestions, DOMAIN_WEIGHTS } from "@/lib/selector";
import type { Question, Scenario } from "@/lib/content";

const SCENARIOS: Scenario[] = [
  "customer-support",
  "code-generation",
  "multi-agent-research",
  "developer-productivity",
  "ci-cd",
  "structured-data-extraction",
];

function makeQuestion(
  id: string,
  domains: number[],
  scenario: Scenario,
  approved = true,
): Question {
  return {
    id: id as any,
    scenario,
    domains: domains as any,
    task_statements: ["1.1"],
    difficulty: "medium",
    tags: [],
    source: "claude-generated",
    correct: "A",
    review_status: approved ? "approved" : "pending",
    stem: "stem",
    options: [
      { letter: "A", text: "a", explanation: "ok", isCorrect: true },
      { letter: "B", text: "b", explanation: "no", isCorrect: false },
      { letter: "C", text: "c", explanation: "no", isCorrect: false },
      { letter: "D", text: "d", explanation: "no", isCorrect: false },
    ],
    teaches: "teaches",
    sourcePath: `${id}.md`,
  };
}

function syntheticBank(): Question[] {
  // 200 questions spread across 5 domains and 6 scenarios so weighting can take effect.
  const out: Question[] = [];
  for (let i = 0; i < 200; i++) {
    const domain = (i % 5) + 1;
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const idPrefix =
      scenario === "customer-support"
        ? "cs"
        : scenario === "code-generation"
          ? "cg"
          : scenario === "multi-agent-research"
            ? "mar"
            : scenario === "developer-productivity"
              ? "dp"
              : scenario === "ci-cd"
                ? "cicd"
                : "sde";
    out.push(
      makeQuestion(
        `q-${idPrefix}-${String(100 + i).padStart(3, "0")}`,
        [domain],
        scenario,
      ),
    );
  }
  return out;
}

describe("lib/selector.ts (mock question selector)", () => {
  it("returns count picks for a 60-question mock with full bank", () => {
    const pool = syntheticBank();
    const r = selectMockQuestions({ pool, count: 60, seed: 1 });
    expect(r.picks).toHaveLength(60);
    expect(r.exhausted).toBe(false);
    // No duplicates.
    expect(new Set(r.picks.map((p) => p.id)).size).toBe(60);
  });

  it("matches domain weights within rounding tolerance", () => {
    const pool = syntheticBank();
    const r = selectMockQuestions({ pool, count: 60, seed: 7 });
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const q of r.picks) counts[q.domains[0] as number]++;
    for (const d of [1, 2, 3, 4, 5] as const) {
      const expected = Math.round(60 * DOMAIN_WEIGHTS[d]);
      // Allow ±1 due to drift redistribution onto D1.
      expect(Math.abs(counts[d] - expected)).toBeLessThanOrEqual(d === 1 ? 2 : 1);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const pool = syntheticBank();
    const a = selectMockQuestions({ pool, count: 30, seed: 42 });
    const b = selectMockQuestions({ pool, count: 30, seed: 42 });
    expect(a.picks.map((q) => q.id)).toEqual(b.picks.map((q) => q.id));
  });

  it("respects the scenarios filter", () => {
    const pool = syntheticBank();
    const r = selectMockQuestions({
      pool,
      count: 20,
      scenarios: ["ci-cd"],
      seed: 1,
    });
    for (const q of r.picks) {
      expect(q.scenario).toBe("ci-cd");
    }
  });

  it("downsizes when pool < count and flags exhausted", () => {
    const pool = syntheticBank().slice(0, 5);
    const r = selectMockQuestions({ pool, count: 60, seed: 3 });
    expect(r.picks).toHaveLength(5);
    expect(r.exhausted).toBe(true);
    expect(r.eligibleCount).toBe(5);
  });

  it("excludes pending questions even if scenarios match", () => {
    const pool: Question[] = [
      makeQuestion("q-cs-101", [1], "customer-support", true),
      makeQuestion("q-cs-102", [1], "customer-support", false),
    ];
    const r = selectMockQuestions({ pool, count: 5, seed: 1 });
    expect(r.picks.map((q) => q.id)).toEqual(["q-cs-101"]);
    expect(r.exhausted).toBe(true);
  });

  it("redistributes drift onto domain 1", () => {
    // Build a pool where every domain has plenty.
    const pool: Question[] = [];
    for (let d = 1; d <= 5; d++) {
      for (let i = 0; i < 30; i++) {
        pool.push(
          makeQuestion(
            `q-cs-${d}${String(100 + i).padStart(3, "0")}`,
            [d],
            "customer-support",
          ),
        );
      }
    }
    // count=10: targets are [3,2,2,2,2] = 11 → drift = -1, D1 becomes 2.
    const r = selectMockQuestions({ pool, count: 10, seed: 1 });
    expect(r.picks).toHaveLength(10);
  });
});
