import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "content");

function readJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), "utf8"));
}

const questions = readJson("questions.json") as unknown[];
const docs = readJson("docs.json") as unknown[];
const scenarios = readJson("scenarios.json") as unknown[];

const stable = JSON.stringify({ questions, docs, scenarios });
const hash = crypto.createHash("sha256").update(stable).digest("hex").slice(0, 16);

const version = {
  hash,
  builtAt: new Date().toISOString(),
  questionCount: questions.length,
  docCount: docs.length,
  scenarioCount: scenarios.length,
};

fs.writeFileSync(
  path.join(OUT_DIR, "version.json"),
  JSON.stringify(version, null, 2),
);

console.log(
  `[content] version=${hash} q=${version.questionCount} d=${version.docCount} s=${version.scenarioCount}`,
);
