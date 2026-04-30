import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ALL_SCENARIOS,
  getDocs,
  type Scenario,
} from "./content";

const MODEL = process.env.RESOURCE_FETCHER_MODEL ?? "claude-sonnet-4-6";

const ResourceTypeSchema = z.enum([
  "video",
  "doc",
  "blog",
  "scenario",
  "course",
  "other",
]);

const ResourceDraftSchema = z.object({
  title: z.string().min(4).max(200),
  url: z.string().url(),
  description: z.string().min(20).max(600),
  type: ResourceTypeSchema,
  domains: z.array(z.number().int().min(1).max(5)).min(1),
  task_statements: z
    .array(z.string().regex(/^[1-5]\.[1-9]$/))
    .default([]),
  why_useful: z.string().max(400).optional(),
});

export type ResourceDraft = z.infer<typeof ResourceDraftSchema>;

const ToolInputSchema = z.object({
  resources: z.array(ResourceDraftSchema).min(1),
});

const SUBMIT_RESOURCES_TOOL: Anthropic.Tool = {
  name: "submit_resources",
  description:
    "Submit a list of vetted external learning resources you found via web search. Each must have a real URL the user can open.",
  input_schema: {
    type: "object",
    properties: {
      resources: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: [
            "title",
            "url",
            "description",
            "type",
            "domains",
          ],
          properties: {
            title: { type: "string" },
            url: {
              type: "string",
              description:
                "Full URL the user can open. Must be from a reputable source you saw in the web_search results.",
            },
            description: {
              type: "string",
              description:
                "1–3 sentence summary of what the resource teaches and why it's relevant to this CCAF domain.",
            },
            type: {
              type: "string",
              enum: ["video", "doc", "blog", "scenario", "course", "other"],
            },
            domains: {
              type: "array",
              minItems: 1,
              items: { type: "integer", minimum: 1, maximum: 5 },
            },
            task_statements: {
              type: "array",
              items: { type: "string", pattern: "^[1-5]\\.[1-9]$" },
            },
            why_useful: {
              type: "string",
              description:
                "Optional. One sentence on why someone who got a related question wrong would benefit from this.",
            },
          },
        },
      },
    },
    required: ["resources"],
  },
};

const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 5,
};

const SYSTEM_INSTRUCTIONS = `You are a research assistant curating learning resources for a team studying for the Anthropic Claude Certified Architect — Foundations (CCAF) exam.

Your job:
1. Use the web_search tool to find real, currently-live URLs of helpful resources for the requested domain or task statement.
2. Prefer in this order:
   - Official Anthropic sources (docs.anthropic.com, anthropic.com/news, Anthropic YouTube channel, anthropic.com/learn)
   - Anthropic Cookbook on GitHub (github.com/anthropics/anthropic-cookbook)
   - Talks and tutorials from Anthropic team members on YouTube
   - High-quality third-party deep-dives (the platform's official blogs, well-cited engineering posts)
3. Skip generic listicles, AI-generated SEO content, or anything you wouldn't recommend to a colleague preparing for a real certification.
4. For each resource, return a SINGLE specific URL — not a homepage. The user must be able to click it and land on the relevant content.
5. Tag domains/task_statements based on the relevance — be honest, don't overclaim.

When done, call submit_resources with all resources in one call. Aim for 3–5 high-quality resources, not a long shallow list.`;

const DOMAIN_TITLES: Record<number, string> = {
  1: "Agentic Architecture & Orchestration",
  2: "Tool Design & MCP Integration",
  3: "Claude Code Configuration & Workflows",
  4: "Prompt Engineering",
  5: "Context Management & Reliability",
};

export type FetchInput = {
  domain: number;
  taskStatement?: string;
  scenario?: Scenario;
  /** Free-form notes to focus the search ("slash commands", "tool design"). */
  keywords?: string;
  count?: number;
};

export type FetchOutput = {
  drafts: ResourceDraft[];
  rejected: { reason: string; raw: unknown }[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearchCalls: number;
  model: string;
};

function loadDomainGuide(domain: number): string {
  const docs = getDocs();
  const guide = docs.find(
    (d) => d.group === "domain" && d.slug.startsWith(`domain/${domain}`),
  );
  if (!guide) {
    throw new Error(`No domain guide found for domain ${domain}.`);
  }
  return guide.body;
}

export async function fetchResourceSuggestions(
  input: FetchInput,
): Promise<FetchOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!ALL_SCENARIOS.includes(input.scenario as any) && input.scenario) {
    throw new Error(`Unknown scenario ${input.scenario}`);
  }
  const count = input.count ?? 4;
  const guide = loadDomainGuide(input.domain);

  const userPromptParts: string[] = [];
  userPromptParts.push(
    `Find ${count} high-quality learning resources for **CCAF Domain ${input.domain}: ${DOMAIN_TITLES[input.domain]}**.`,
  );
  if (input.taskStatement) {
    userPromptParts.push(
      `Focus on task statement \`${input.taskStatement}\` specifically.`,
    );
  }
  if (input.scenario) {
    userPromptParts.push(`Scenario context: ${input.scenario}.`);
  }
  if (input.keywords) {
    userPromptParts.push(`Keywords/angles to consider: ${input.keywords}`);
  }
  userPromptParts.push(
    "Use web_search to find real URLs. When done, call submit_resources with the curated list.",
  );

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      {
        type: "text",
        text: `## Domain ${input.domain} guide (excerpt — use to evaluate relevance):\n\n${guide.slice(0, 6000)}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [WEB_SEARCH_TOOL as any, SUBMIT_RESOURCES_TOOL],
    messages: [{ role: "user", content: userPromptParts.join("\n\n") }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === "submit_resources",
  ) as Anthropic.ToolUseBlock | undefined;

  if (!toolUse) {
    throw new Error(
      `Resource fetcher did not return a submit_resources call. stop_reason=${response.stop_reason}`,
    );
  }

  const parsed = ToolInputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Resource fetcher output failed top-level Zod parse: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  const drafts: ResourceDraft[] = [];
  const rejected: { reason: string; raw: unknown }[] = [];

  for (const raw of parsed.data.resources) {
    const item = ResourceDraftSchema.safeParse(raw);
    if (!item.success) {
      rejected.push({
        reason: JSON.stringify(item.error.flatten()),
        raw,
      });
      continue;
    }
    drafts.push(item.data);
  }

  const webSearchCalls = response.content.filter(
    (b) => b.type === "server_tool_use",
  ).length;

  const usage = response.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  return {
    drafts,
    rejected,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    webSearchCalls,
    model: MODEL,
  };
}
