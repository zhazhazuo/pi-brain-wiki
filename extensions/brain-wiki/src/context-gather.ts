import { join } from "node:path";
import type {
  GatherEvidence,
  GatherExternalContextInput,
  GatherExternalContextResult,
  ResolvedExternalContext,
} from "./types.ts";

const QUERY_REQUIRED_INTENTS = new Set(["implementation", "question"]);
const MAX_SEED_FILES = 3;
const MAX_SEARCH_RESULTS = 5;
const MAX_COMMITS = 5;

export async function gatherExternalContext(
  context: ResolvedExternalContext,
  input: GatherExternalContextInput,
): Promise<GatherExternalContextResult> {
  if (!context.allowed_intents.includes(input.intent)) {
    throw new Error("Intent not allowed");
  }

  if (QUERY_REQUIRED_INTENTS.has(input.intent) && !input.query?.trim()) {
    throw new Error(`Intent "${input.intent}" requires a query`);
  }

  const filesRead: string[] = [];
  const commandsUsed: string[] = [];
  const summary: string[] = [];
  const evidence: GatherEvidence[] = [];
  const limitsHit: string[] = [];
  const followUpSuggestions: string[] = [];

  const seedFiles = context.seed_files.slice(0, MAX_SEED_FILES);
  if (context.seed_files.length > MAX_SEED_FILES) {
    limitsHit.push(`seed_files:${MAX_SEED_FILES}`);
  }

  if (input.intent === "overview" || input.intent === "architecture" || input.intent === "handoff") {
    await readSeedFiles(context, seedFiles, input, filesRead, commandsUsed, summary, evidence);
  }

  if (input.intent === "overview" || input.intent === "architecture") {
    const repoFiles = await safeListRepoFiles(input);
    if (repoFiles) {
      commandsUsed.push("listRepoFiles");
      summary.push(`Repo file listing returned ${repoFiles.length} paths.`);
      evidence.push({
        kind: "note",
        label: "repo-files",
        detail: repoFiles.slice(0, MAX_SEARCH_RESULTS).join(", "),
      });
    } else {
      limitsHit.push("repo-files-unavailable");
    }
  }

  if (input.intent === "architecture") {
    const searchQuery = buildSearchQuery(context, "architecture");
    const results = await safeSearchRepo(input, searchQuery);
    if (results) {
      commandsUsed.push("searchRepo");
      if (results.length > MAX_SEARCH_RESULTS) {
        limitsHit.push(`search-results:${MAX_SEARCH_RESULTS}`);
      }
      summary.push(`Architecture search used "${searchQuery}".`);
      for (const match of results.slice(0, MAX_SEARCH_RESULTS)) {
        evidence.push({ kind: "search", label: searchQuery, detail: match });
      }
    } else {
      limitsHit.push("search-unavailable");
    }
    followUpSuggestions.push("Ask for implementation details about a specific subsystem.");
  }

  if (input.intent === "implementation" || input.intent === "question") {
    const query = input.query!.trim();
    const results = await safeSearchRepo(input, query);
    if (results) {
      commandsUsed.push("searchRepo");
      if (results.length > MAX_SEARCH_RESULTS) {
        limitsHit.push(`search-results:${MAX_SEARCH_RESULTS}`);
      }
      summary.push(`Searched the repo for "${query}".`);
      for (const match of results.slice(0, MAX_SEARCH_RESULTS)) {
        evidence.push({ kind: "search", label: query, detail: match });
      }
    } else {
      limitsHit.push("search-unavailable");
    }
    followUpSuggestions.push("Provide an exact file, symbol, or error message to narrow the gather.");
  }

  if (input.intent === "recent_changes" || input.intent === "handoff") {
    const commits = await safeGetRecentCommits(input);
    if (commits) {
      commandsUsed.push("getRecentCommits");
      if (commits.length > MAX_COMMITS) {
        limitsHit.push(`commits:${MAX_COMMITS}`);
      }
      summary.push(`Recent commit sample captured from ${context.label}.`);
      for (const commit of commits.slice(0, MAX_COMMITS)) {
        evidence.push({ kind: "commit", label: "recent-commit", detail: commit });
      }
    } else {
      limitsHit.push("commits-unavailable");
    }
  }

  if (input.intent === "overview") {
    summary.push(`Overview gather focused on seed files and top-level repo shape for ${context.label}.`);
    followUpSuggestions.push("Ask for architecture to inspect subsystem boundaries.");
  }

  if (input.intent === "recent_changes") {
    followUpSuggestions.push("Ask for implementation with a query to inspect a changed area.");
  }

  if (input.intent === "handoff") {
    summary.push(`Handoff gather combined seed files with recent commit context for ${context.label}.`);
    followUpSuggestions.push("Ask a focused question about the next task or open issue.");
  }

  if (summary.length === 0) {
    summary.push(`No gather actions were available for intent "${input.intent}".`);
  }

  return {
    context_id: context.context_id,
    repo_path: context.repo_path,
    intent: input.intent,
    files_read: dedupe(filesRead),
    commands_used: dedupe(commandsUsed),
    summary,
    evidence,
    limits_hit: dedupe(limitsHit),
    follow_up_suggestions: dedupe(followUpSuggestions),
  };
}

async function readSeedFiles(
  context: ResolvedExternalContext,
  seedFiles: string[],
  input: GatherExternalContextInput,
  filesRead: string[],
  commandsUsed: string[],
  summary: string[],
  evidence: GatherEvidence[],
): Promise<void> {
  if (!input.readTextFile) {
    return;
  }

  for (const relativePath of seedFiles) {
    const fullPath = join(context.repo_path, relativePath);
    const content = await input.readTextFile(fullPath);
    filesRead.push(relativePath);
    commandsUsed.push("readTextFile");
    summary.push(`Read seed file ${relativePath}.`);
    evidence.push({
      kind: "file",
      label: relativePath,
      detail: summarizeText(content),
    });
  }
}

function buildSearchQuery(context: ResolvedExternalContext, fallback: string): string {
  return context.search_terms[0] ?? context.include_paths[0] ?? fallback;
}

async function safeListRepoFiles(input: GatherExternalContextInput): Promise<string[] | null> {
  if (!input.listRepoFiles) {
    return null;
  }

  return input.listRepoFiles();
}

async function safeSearchRepo(input: GatherExternalContextInput, query: string): Promise<string[] | null> {
  if (!input.searchRepo) {
    return null;
  }

  return input.searchRepo(query);
}

async function safeGetRecentCommits(input: GatherExternalContextInput): Promise<string[] | null> {
  if (!input.getRecentCommits) {
    return null;
  }

  return input.getRecentCommits();
}

function summarizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
