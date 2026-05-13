import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { writePage } from "./frontmatter.ts";
import { metaPath, toRelative } from "./paths.ts";
import { dedupeSlug, slugifyTitle, todayStamp } from "./slug.ts";
import type {
  RegistryData,
  WorkflowParams,
  WorkflowResult,
  WorkflowStatus,
} from "./types.ts";
import type { ObsidianClient } from "./obsidian-client.ts";

const WORKFLOW_VERSION = 1;

export async function createWorkflow(
  root: string,
  registry: RegistryData,
  params: WorkflowParams,
  client?: ObsidianClient | null,
): Promise<WorkflowResult> {
  validateWorkflowParams(params);

  const normalizedTitle = normalizeLookup(params.title);
  const triggers = cleanList(params.triggers);
  const inputs = cleanList(params.inputs);
  const steps = cleanList(params.steps);
  const constraints = cleanList(params.constraints ?? []);
  const tags = cleanList(params.tags ?? []);
  const normalizedTriggers = new Set(triggers.map(normalizeLookup));
  const matches = registry.pages.filter((page) => {
    if (page.type !== "workflow") return false;
    if (normalizeLookup(page.title) === normalizedTitle) return true;
    return page.aliases.some((alias) => normalizedTriggers.has(normalizeLookup(alias)));
  });

  if (matches.length > 0) {
    return {
      created: false,
      conflict: true,
      candidates: matches.map((page) => ({
        id: page.id,
        path: page.path,
        title: page.title,
        status: page.status,
      })),
    };
  }

  const now = new Date();
  const updated = todayStamp(now);
  const baseSlug = slugifyTitle(params.title);
  const existingSlugs = registry.pages
    .filter((page) => page.type === "workflow")
    .map((page) => basename(page.path, ".md"));
  const slug = dedupeSlug(baseSlug, existingSlugs);
  const id = `workflow-${slug}`;
  const status = params.status ?? "draft";
  const absolutePath = join(root, "pages", "workflows", `${slug}.md`);
  const summary = params.summary?.trim() || firstSentence(params.goal);

  const frontmatter = {
    id,
    type: "workflow",
    title: params.title.trim(),
    status,
    updated,
    version: WORKFLOW_VERSION,
    triggers,
    aliases: triggers,
    tags,
    summary,
  };

  const body = renderWorkflowBody({
    id,
    title: params.title.trim(),
    status,
    triggers,
    goal: params.goal.trim(),
    inputs,
    steps,
    output: params.output.trim(),
    constraints,
  });

  await writePage(absolutePath, frontmatter, body, client);

  return {
    created: true,
    conflict: false,
    path: toRelative(root, absolutePath),
    id,
    title: params.title.trim(),
    status,
  };
}

export interface RenderWorkflowBodyParams {
  id: string;
  title: string;
  status: WorkflowStatus;
  triggers: string[];
  goal: string;
  inputs: string[];
  steps: string[];
  output: string;
  constraints?: string[];
}

export function renderWorkflowBody(params: RenderWorkflowBodyParams): string {
  const lines: string[] = [
    `# ${params.title}`,
    "",
    "## Workflow YAML",
    "",
    "```yaml",
    `version: ${WORKFLOW_VERSION}`,
    `id: ${params.id}`,
    `title: ${yamlScalar(params.title)}`,
    `status: ${params.status}`,
    "triggers:",
    ...yamlList(params.triggers),
    "goal: |-",
    ...yamlBlock(params.goal),
    "inputs:",
    ...yamlList(params.inputs),
    "steps:",
    ...yamlList(params.steps),
    "output: |-",
    ...yamlBlock(params.output),
    "constraints:",
    ...(params.constraints && params.constraints.length > 0 ? yamlList(params.constraints) : ["  []"]),
    "```",
    "",
    "## Notes",
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function rebuildWorkflowRoutes(
  root: string,
  registry: RegistryData,
): Promise<string> {
  const routePath = metaPath(root, "workflows.md");
  await mkdir(join(root, "meta"), { recursive: true });
  await writePage(routePath, {
    type: "workflow-routes",
    updated: todayStamp(),
  }, renderWorkflowRoutes(registry));
  return toRelative(root, routePath);
}

export function renderWorkflowRoutes(registry: RegistryData): string {
  const workflows = registry.pages
    .filter((page) => page.type === "workflow")
    .sort((a, b) => a.title.localeCompare(b.title));

  const active = workflows.filter((page) => page.status === "active");
  const draft = workflows.filter((page) => page.status !== "active");
  const lines: string[] = [
    "# Workflow Routes",
    "",
    "## Active",
    "",
    ...renderRouteTable(active),
    "",
    "## Draft",
    "",
    ...renderRouteTable(draft),
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderRouteTable(workflows: RegistryData["pages"]): string[] {
  const lines = ["| Trigger | Workflow | Use When |", "|---|---|---|"];
  if (workflows.length === 0) {
    lines.push("|  | _None_ |  |");
    return lines;
  }

  for (const workflow of workflows) {
    const trigger = workflow.aliases[0] ?? "";
    const link = workflow.path
      .replace(/^pages\//, "")
      .replace(/\.md$/, "");
    lines.push(`| ${escapeTable(trigger)} | [[${link}|${escapeTable(workflow.title)}]] | ${escapeTable(workflow.summary ?? "")} |`);
  }
  return lines;
}

function validateWorkflowParams(params: WorkflowParams): void {
  if (!params.title?.trim()) throw new Error("Workflow title is required.");
  if (!params.goal?.trim()) throw new Error("Workflow goal is required.");
  if (!params.triggers?.some((trigger) => trigger.trim())) {
    throw new Error("At least one workflow trigger is required.");
  }
  if (!params.inputs?.some((input) => input.trim())) {
    throw new Error("At least one workflow input is required.");
  }
  if (!params.steps?.some((step) => step.trim())) {
    throw new Error("At least one workflow step is required.");
  }
  if (!params.output?.trim()) throw new Error("Workflow output is required.");
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : trimmed;
}

function yamlList(values: string[]): string[] {
  const cleaned = cleanList(values);
  return cleaned.length > 0
    ? cleaned.map((value) => `  - ${yamlScalar(value)}`)
    : ["  []"];
}

function yamlBlock(value: string): string[] {
  const lines = value.trimEnd().split("\n");
  return lines.map((line) => `  ${line}`);
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}
