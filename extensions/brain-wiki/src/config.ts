import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ContextGatherIntent, ExternalContextConfig, LocalEnvConfig, WikiConfig } from "./types.ts";

const CONFIG_RELATIVE_PATH = join(".wiki", "config.json");
export const LOCAL_ENV_RELATIVE_PATH = join(".wiki", "env.local.json");
const LOCAL_ENV_EXAMPLE_RELATIVE_PATH = join(".wiki", "env.local.example.json");
const ALLOWED_CONTEXT_INTENTS: ContextGatherIntent[] = [
  "overview",
  "architecture",
  "implementation",
  "recent_changes",
  "question",
  "handoff",
];

export function createDefaultConfig(title: string, domain = "General"): WikiConfig {
  return {
    version: 1,
    title,
    domain,
    timezone: "UTC",
    paths: {
      inbox: "inbox",
      pages: "pages",
      meta: "meta",
      archive: "archive",
    },
    pageTypes: {
      summary: "pages/summaries",
      topic: "pages/topics",
      plan: "pages/plans",
      review: "pages/reviews",
      workflow: "pages/workflows",
    },
    templates: {
      summary: ".wiki/templates/summary.md",
      topic: ".wiki/templates/topic.md",
      plan: ".wiki/templates/plan.md",
      review: ".wiki/templates/review.md",
      workflow: ".wiki/templates/workflow.md",
    },
    linkStyle: "wikilink-folder-qualified",
    citationStyle: "source-page-id-link",
    protect: [
      "Area/**",
      "inbox/**",
      "meta/registry.json",
      "meta/backlinks.json",
      "meta/events.jsonl",
      "meta/index.md",
      "meta/log.md",
      "meta/lint-report.md",
      "meta/workflows.md",
    ],
    allowExternal: [
      "../LIST.md",
      "../Project/**",
      "../Resource/**",
      "../Draft/**",
    ],
    search: {
      defaultLimit: 10,
    },
    contexts: {},
  };
}

export async function hasWikiConfig(root: string): Promise<boolean> {
  try {
    await access(join(root, CONFIG_RELATIVE_PATH));
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(root: string): Promise<WikiConfig> {
  const path = join(root, CONFIG_RELATIVE_PATH);
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<WikiConfig>;

  const fallback = createDefaultConfig(parsed.title ?? "Wiki", parsed.domain ?? "General");

  return {
    ...fallback,
    ...parsed,
    paths: {
      ...fallback.paths,
      ...(parsed.paths ?? {}),
    },
    pageTypes: {
      ...fallback.pageTypes,
      ...(parsed.pageTypes ?? {}),
    },
    templates: {
      ...fallback.templates,
      ...(parsed.templates ?? {}),
    },
    search: {
      ...fallback.search,
      ...(parsed.search ?? {}),
    },
    protect: Array.isArray(parsed.protect) ? parsed.protect : fallback.protect,
    allowExternal: Array.isArray(parsed.allowExternal) ? parsed.allowExternal : fallback.allowExternal,
    contexts: normalizeContexts(parsed.contexts),
  };
}

export async function loadLocalEnvConfig(root: string): Promise<LocalEnvConfig> {
  const path = join(root, LOCAL_ENV_RELATIVE_PATH);

  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalEnvConfig>;
    return {
      repos: normalizeStringRecord(parsed.repos),
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { repos: {} };
    }

    throw error;
  }
}

export async function writeDefaultConfig(root: string, title: string, domain?: string): Promise<string> {
  const path = join(root, CONFIG_RELATIVE_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(createDefaultConfig(title, domain), null, 2)}\n`, "utf8");
  return path;
}

export async function writeLocalEnvExample(root: string): Promise<string> {
  const path = join(root, LOCAL_ENV_EXAMPLE_RELATIVE_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({
    repos: {
      example_repo_key: "/absolute/path/to/local/repo",
    },
  }, null, 2)}\n`, "utf8");
  return path;
}

function normalizeContexts(value: unknown): Record<string, ExternalContextConfig> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, ExternalContextConfig> = {};

  for (const [key, entry] of Object.entries(value)) {
    const context = normalizeContextEntry(entry);
    if (context) {
      normalized[key] = context;
    }
  }

  return normalized;
}

function normalizeContextEntry(value: unknown): ExternalContextConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.label !== "string" ||
    typeof value.pkb_note !== "string" ||
    typeof value.repo_key !== "string" ||
    !Array.isArray(value.allowed_intents)
  ) {
    return null;
  }

  const allowed_intents = value.allowed_intents.filter(
    (intent): intent is ContextGatherIntent =>
      typeof intent === "string" && ALLOWED_CONTEXT_INTENTS.includes(intent as ContextGatherIntent),
  );

  const normalized: ExternalContextConfig = {
    label: value.label,
    pkb_note: value.pkb_note,
    repo_key: value.repo_key,
    allowed_intents,
  };

  const seed_files = normalizeStringArray(value.seed_files);
  if (seed_files.length > 0) {
    normalized.seed_files = seed_files;
  }

  const include_paths = normalizeStringArray(value.include_paths);
  if (include_paths.length > 0) {
    normalized.include_paths = include_paths;
  }

  const exclude_paths = normalizeStringArray(value.exclude_paths);
  if (exclude_paths.length > 0) {
    normalized.exclude_paths = exclude_paths;
  }

  const search_terms = normalizeStringArray(value.search_terms);
  if (search_terms.length > 0) {
    normalized.search_terms = search_terms;
  }

  if (typeof value.notes === "string") {
    normalized.notes = value.notes;
  }

  return normalized;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
