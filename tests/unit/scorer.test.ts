import { describe, expect, it } from "vitest";
import { PASS_THRESHOLD_SCALED, scoreMock } from "@/lib/scorer";
import type { Letter, Question, Scenario } from "@/lib/content";

function q(
  id: string,
  domains: number[],
  scenario: Scenario,
  correct: Letter = "A",
): Question {
  return {
    id: id as any,
    scenario,
    domains: domains as any,
    task_statements: ["1.1"],
    difficulty: "medium",
    tags: [],
    source: "claude-generated",
    correct,
    review_status: "approved",
    stem: "stem",
    options: ["A", "B", "C", "D"].map((L) => ({
      letter: L as Letter,
      text: L,
      explanation: L,
      isCorrect: L === correct,
    })),
    teaches: "teaches",
    sourcePath: `${id}.md`,
  };
}

describe("lib/scorer.ts", () => {
  it("scores all-correct as 1000 scaled and passes", () => {
    const questions = [
      q("q-cs-001", [1], "customer-support", "A"),
      q("q-cg-001", [2], "code-generation", "B"),
      q("q-mar-001", [3], "multi-agent-research", "C"),
    ];
    const r = scoreMock({ questions, answers: ["A", "B", "C"] });
    expect(r.correct).toBe(3);
    expect(r.total).toBe(3);
    expect(r.scaledEstimate).toBe(1000);
    expect(r.passedThreshold720).toBe(true);
    expect(r.weakestDomains).toEqual([]);
  });

  it("treats null answers as incorrect", () => {
    const questions = [
      q("q-cs-001", [1], "customer-support", "A"),
      q("q-cs-002", [1], "customer-support", "B"),
    ];
    const r = scoreMock({ questions, answers: ["A", null] });
    expect(r.correct).toBe(1);
    expect(r.scaledEstimate).toBe(500);
    expect(r.incorrect).toHaveLength(1);
    expect(r.incorrect[0].userAnswer).toBeNull();
    expect(r.incorrect[0].correctAnswer).toBe("B");
  });

  it("counts a multi-domain question under each listed domain", () => {
    const questions = [q("q-cs-001", [1, 3], "customer-support", "A")];
    const r = scoreMock({ questions, answers: ["A"] });
    expect(r.perDomain["1"].correct).toBe(1);
    expect(r.perDomain["1"].total).toBe(1);
    expect(r.perDomain["3"].correct).toBe(1);
    expect(r.perDomain["3"].total).toBe(1);
    expect(r.perDomain["2"]).toBeUndefined();
  });

  it("uses the 720 boundary correctly for raw=43/60 and 44/60", () => {
    const make60 = (rightCount: number) => {
      const questions: Question[] = [];
      const answers: (Letter | null)[] = [];
      for (let i = 0; i < 60; i++) {
        const correct = (["A", "B", "C", "D"] as const)[i % 4];
        questions.push(q(`q-cs-${String(100 + i).padStart(3, "0")}`, [1], "customer-support", correct));
        answers.push(i < rightCount ? correct : (correct === "A" ? "B" : "A"));
      }
      return { questions, answers };
    };

    // 43/60 → round(1000*43/60) = round(716.67) = 717
    const r43 = scoreMock(make60(43));
    expect(r43.scaledEstimate).toBe(717);
    expect(r43.passedThreshold720).toBe(false);

    // 44/60 → round(1000*44/60) = round(733.33) = 733
    const r44 = scoreMock(make60(44));
    expect(r44.scaledEstimate).toBe(733);
    expect(r44.passedThreshold720).toBe(true);

    expect(PASS_THRESHOLD_SCALED).toBe(720);
  });

  it("identifies the two weakest domains with tie-break on volume", () => {
    const qs = [
      // Domain 1: 4 attempts, 3 correct (75%)
      q("q-1a", [1], "customer-support", "A"),
      q("q-1b", [1], "customer-support", "A"),
      q("q-1c", [1], "customer-support", "A"),
      q("q-1d", [1], "customer-support", "A"),
      // Domain 2: 4 attempts, 1 correct (25%)
      q("q-2a", [2], "customer-support", "A"),
      q("q-2b", [2], "customer-support", "A"),
      q("q-2c", [2], "customer-support", "A"),
      q("q-2d", [2], "customer-support", "A"),
      // Domain 3: 2 attempts, 0 correct (0%)
      q("q-3a", [3], "customer-support", "A"),
      q("q-3b", [3], "customer-support", "A"),
    ];
    const ans: Letter[] = [
      "A", "A", "A", "B",       // D1: 3/4
      "A", "B", "B", "B",       // D2: 1/4
      "B", "B",                 // D3: 0/2
    ];
    const r = scoreMock({ questions: qs, answers: ans });
    expect(r.weakestDomains).toEqual([3, 2]);
  });
});
