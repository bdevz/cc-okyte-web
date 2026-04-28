/**
 * Build-time content compiler.
 *
 * Walks vendor/consultadd-claude-architect/ (the pinned submodule), parses
 * markdown questions / docs / scenario READMEs, validates frontmatter against
 * a Zod schema mirroring practice/schemas/question.schema.json, and emits
 * typed JSON bundles that the Next.js app imports directly.
 *
 * Build fails if any question is malformed — that's the point. Source of
 * truth is the markdown; this script enforces the contract.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SUBMODULE = path.join(ROOT, "vendor", "consultadd-claude-architect");
const OUT_DIR = path.join(ROOT, "content");

const SCENARIO_ENUM = z.enum([
  "customer-support",
  "code-generation",
  "multi-agent-research",
  "developer-productivity",
  "ci-cd",
  "structured-data-extraction",
]);

const FrontmatterSchema = z.object({
  id: z.string().regex(/^q-(cs|cg|mar|dp|cicd|sde)-[0-9]{3}$/),
  scenario: SCENARIO_ENUM,
  domains: z.array(z.number().int().min(1).max(5)).min(1).max(5),
  task_statements: z.array(z.string().regex(/^[1-5]\.[1-9]$/)).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z.array(z.string()).optional().default([]),
  source: z.enum([
    "official-sample",
    "official-exercise",
    "claude-generated",
    "team-contributed",
  ]),
  correct: z.enum(["A", "B", "C", "D"]),
  review_status: z.enum(["pending", "approved"]).optional().default("approved"),
});

type Letter = "A" | "B" | "C" | "D";
const LETTERS: Letter[] = ["A", "B", "C", "D"];

type ParsedBody = {
  stem: string;
  options: { letter: Letter; text: string }[];
  perOptionExplanation: Record<Letter, string>;
  bodyCorrect: Letter;
  teaches: string;
};

function splitSections(body: string): Record<string, string> {
  const lines = body.split("\n");
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join("\n").trim();
    buf = [];
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].trim();
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

function parseOptions(raw: string, file: string): ParsedBody["options"] {
  const lines = raw.split("\n");
  const startRe = /^- \*\*([A-D])\)\*\*\s+(.*)$/;
  const groups: { letter: Letter; buf: string[] }[] = [];
  let current: { letter: Letter; buf: string[] } | null = null;
  for (const line of lines) {
    const m = startRe.exec(line);
    if (m) {
      if (current) groups.push(current);
      current = { letter: m[1] as Letter, buf: [m[2]] };
    } else if (current) {
      current.buf.push(line);
    }
  }
  if (current) groups.push(current);

  if (groups.length !== 4) {
    throw new Error(
      `[${file}] expected 4 options under ## Options, got ${groups.length}`,
    );
  }
  const seen = new Set<Letter>();
  for (const g of groups) {
    if (seen.has(g.letter)) {
      throw new Error(`[${file}] duplicate option letter ${g.letter}`);
    }
    seen.add(g.letter);
  }
  groups.sort((a, b) => LETTERS.indexOf(a.letter) - LETTERS.indexOf(b.letter));
  return groups.map((g) => ({ letter: g.letter, text: g.buf.join("\n").trim() }));
}

function parseExplanation(
  raw: string,
  file: string,
): { perOption: Record<Letter, string>; bodyCorrect: Letter } {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    throw new Error(`[${file}] ## Explanation section is empty`);
  }

  const correctRe = /^\*\*Correct:\s*([A-D])\.\*\*\s*([\s\S]*)$/;
  const failsRe = /^\*\*([A-D])\s+fails because\*\*\s*([\s\S]*)$/i;

  const perOption: Partial<Record<Letter, string>> = {};
  let bodyCorrect: Letter | undefined;

  for (const para of paragraphs) {
    const c = correctRe.exec(para);
    if (c) {
      const letter = c[1] as Letter;
      bodyCorrect = letter;
      perOption[letter] = c[2].trim();
      continue;
    }
    const f = failsRe.exec(para);
    if (f) {
      const letter = f[1].toUpperCase() as Letter;
      perOption[letter] = `${letter} fails because ${f[2].trim()}`;
      continue;
    }
  }

  if (!bodyCorrect) {
    throw new Error(
      `[${file}] ## Explanation must start with "**Correct: <X>.**"`,
    );
  }
  for (const L of LETTERS) {
    if (!perOption[L]) {
      throw new Error(
        `[${file}] ## Explanation missing entry for option ${L}. ` +
          `Each distractor must have a "**${L} fails because** ..." paragraph.`,
      );
    }
  }
  return {
    perOption: perOption as Record<Letter, string>,
    bodyCorrect,
  };
}

function parseQuestionBody(body: string, file: string): ParsedBody {
  const sections = splitSections(body);
  const required = ["Stem", "Options", "Explanation", "Teaches"] as const;
  for (const s of required) {
    if (!sections[s]) {
      throw new Error(`[${file}] missing required ## ${s} section`);
    }
  }
  const options = parseOptions(sections.Options, file);
  const { perOption, bodyCorrect } = parseExplanation(sections.Explanation, file);
  return {
    stem: sections.Stem.trim(),
    options,
    perOptionExplanation: perOption,
    bodyCorrect,
    teaches: sections.Teaches.trim(),
  };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "_pending") continue;
      out.push(...walk(p));
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

function rel(p: string): string {
  return path.relative(SUBMODULE, p).split(path.sep).join("/");
}

function buildQuestions() {
  const dir = path.join(SUBMODULE, "practice", "questions", "by-scenario");
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Submodule path missing: ${dir}\n` +
        `Did you run \`git submodule update --init --recursive\`?`,
    );
  }
  const files = walk(dir).filter(
    (f) => f.endsWith(".md") && !path.basename(f).startsWith("_"),
  );
  const out: any[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const { data, content } = matter(raw);
    const fm = FrontmatterSchema.parse(data);
    if (fm.review_status !== "approved") continue;
    const parsed = parseQuestionBody(content, file);
    if (parsed.bodyCorrect !== fm.correct) {
      throw new Error(
        `[${rel(file)}] frontmatter correct=${fm.correct} but body says correct=${parsed.bodyCorrect}`,
      );
    }
    out.push({
      ...fm,
      stem: parsed.stem,
      options: parsed.options.map((o) => ({
        letter: o.letter,
        text: o.text,
        explanation: parsed.perOptionExplanation[o.letter],
        isCorrect: o.letter === fm.correct,
      })),
      teaches: parsed.teaches,
      sourcePath: rel(file),
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function firstH1(body: string, fallback: string): string {
  const m = /^#\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : fallback;
}

function buildDocs() {
  const out: any[] = [];
  const docsDir = path.join(SUBMODULE, "docs");
  if (!fs.existsSync(docsDir)) return out;
  const files = walk(docsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const r = rel(file);
    const body = fs.readFileSync(file, "utf8");
    const { data, content } = matter(body);
    let group: "intro" | "domain" | "cheatsheet" = "intro";
    if (r.includes("/domains/")) group = "domain";
    else if (r.includes("/cheatsheets/")) group = "cheatsheet";
    const slug = path
      .basename(file, ".md")
      .replace(/^[0-9]+-/, "")
      .toLowerCase();
    out.push({
      slug:
        group === "domain"
          ? `domain/${path.basename(file, ".md")}`
          : group === "cheatsheet"
            ? `cheatsheet/${path.basename(file, ".md")}`
            : slug,
      title:
        typeof data?.title === "string" ? data.title : firstH1(content, slug),
      group,
      body: content,
      sourcePath: r,
    });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

function buildScenarios() {
  const out: any[] = [];
  const dir = path.join(SUBMODULE, "scenarios");
  if (!fs.existsSync(dir)) return out;
  const folders = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const NAME_TO_SCENARIO: Record<string, string> = {
    "01-customer-support": "customer-support",
    "02-code-generation": "code-generation",
    "03-multi-agent-research": "multi-agent-research",
    "04-developer-productivity": "developer-productivity",
    "05-ci-cd": "ci-cd",
    "06-structured-extraction": "structured-data-extraction",
  };
  for (const folder of folders) {
    const readme = path.join(dir, folder, "README.md");
    if (!fs.existsSync(readme)) continue;
    const body = fs.readFileSync(readme, "utf8");
    const scenarioKey = NAME_TO_SCENARIO[folder];
    if (!scenarioKey) continue;
    out.push({
      slug: `scenario/${folder}`,
      scenario: scenarioKey,
      title: firstH1(body, folder),
      body,
      sourcePath: rel(readme),
    });
  }
  return out;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const questions = buildQuestions();
  const docs = buildDocs();
  const scenarios = buildScenarios();

  fs.writeFileSync(
    path.join(OUT_DIR, "questions.json"),
    JSON.stringify(questions, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "docs.json"),
    JSON.stringify(docs, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "scenarios.json"),
    JSON.stringify(scenarios, null, 2),
  );

  const approvedCount = questions.length;
  console.log(
    `[content] questions=${approvedCount} docs=${docs.length} scenarios=${scenarios.length}`,
  );
}

main();
