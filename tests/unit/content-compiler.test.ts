import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const CONTENT = path.join(ROOT, "content");

/**
 * The compiler is the load-bearing piece of this app — every other test depends
 * on the JSON it produces. This test runs the real script, then asserts that:
 *   1. content/{questions,docs,scenarios,version}.json exist and parse.
 *   2. Every question has 4 options with the expected shape.
 *   3. Question id pattern + correct-letter consistency holds.
 */
describe("scripts/build-content.ts", () => {
  it("compiles the bank to typed JSON and version metadata", () => {
    if (!fs.existsSync(path.join(ROOT, "vendor", "consultadd-claude-architect"))) {
      // Skip when running in a fresh clone without the submodule fetched.
      return;
    }
    execSync("npm run content:build", { cwd: ROOT, stdio: "pipe" });

    const questions = JSON.parse(
      fs.readFileSync(path.join(CONTENT, "questions.json"), "utf8"),
    ) as any[];
    const docs = JSON.parse(
      fs.readFileSync(path.join(CONTENT, "docs.json"), "utf8"),
    ) as any[];
    const scenarios = JSON.parse(
      fs.readFileSync(path.join(CONTENT, "scenarios.json"), "utf8"),
    ) as any[];
    const version = JSON.parse(
      fs.readFileSync(path.join(CONTENT, "version.json"), "utf8"),
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(docs.length).toBeGreaterThan(0);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(version.hash).toMatch(/^[a-f0-9]+$/);

    for (const q of questions) {
      expect(q.id).toMatch(/^q-(cs|cg|mar|dp|cicd|sde)-[0-9]{3}$/);
      expect(q.options).toHaveLength(4);
      const letters = q.options.map((o: any) => o.letter).sort();
      expect(letters).toEqual(["A", "B", "C", "D"]);
      const correctOpt = q.options.find((o: any) => o.isCorrect);
      expect(correctOpt?.letter).toBe(q.correct);
      for (const opt of q.options) {
        expect(opt.explanation.length).toBeGreaterThan(0);
      }
      expect(q.review_status).toBe("approved");
    }
  });
});
