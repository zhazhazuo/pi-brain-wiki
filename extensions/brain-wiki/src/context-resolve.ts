import { stat } from "node:fs/promises";
import { isAbsolute, win32 } from "node:path";
import { loadConfig, loadLocalEnvConfig } from "./config.ts";
import type {
  ExternalContextConfig,
  ResolveExternalContextInput,
  ResolvedExternalContext,
} from "./types.ts";

export async function resolveExternalContext(
  root: string,
  input: ResolveExternalContextInput,
): Promise<ResolvedExternalContext> {
  const config = await loadConfig(root);
  const env = await loadLocalEnvConfig(root);

  const [contextId, context] = resolveContextEntry(config.contexts, input);
  const repoPath = env.repos[context.repo_key];

  if (!repoPath) {
    throw new Error(`No local repo path configured for repo key "${context.repo_key}"`);
  }

  if (!isAbsolute(repoPath)) {
    throw new Error(`Configured repo path must be absolute for repo key "${context.repo_key}"`);
  }

  let repoStat;
  try {
    repoStat = await stat(repoPath);
  } catch {
    throw new Error(`Configured repo path does not exist for repo key "${context.repo_key}"`);
  }

  if (!repoStat.isDirectory()) {
    throw new Error(`Configured repo path must be an existing directory for repo key "${context.repo_key}"`);
  }

  return {
    context_id: contextId,
    label: context.label,
    pkb_note: context.pkb_note,
    repo_key: context.repo_key,
    repo_path: repoPath,
    allowed_intents: [...context.allowed_intents],
    seed_files: sanitizeRelativePaths(context.seed_files),
    include_paths: sanitizeRelativePaths(context.include_paths),
    exclude_paths: sanitizeRelativePaths(context.exclude_paths),
    search_terms: [...(context.search_terms ?? [])],
    notes: context.notes,
  };
}

function resolveContextEntry(
  contexts: Record<string, ExternalContextConfig>,
  input: ResolveExternalContextInput,
): [string, ExternalContextConfig] {
  if (input.context_id && input.pkb_note) {
    const context = contexts[input.context_id];
    if (!context) {
      throw new Error(`Unknown external context "${input.context_id}"`);
    }

    if (context.pkb_note !== input.pkb_note) {
      throw new Error("context_id and pkb_note must refer to the same external context");
    }

    return [input.context_id, context];
  }

  if (input.context_id) {
    const context = contexts[input.context_id];
    if (!context) {
      throw new Error(`Unknown external context "${input.context_id}"`);
    }

    return [input.context_id, context];
  }

  if (input.pkb_note) {
    const match = Object.entries(contexts).find(([, context]) => context.pkb_note === input.pkb_note);
    if (!match) {
      throw new Error(`Unknown external context for PKB note "${input.pkb_note}"`);
    }

    return match;
  }

  throw new Error("Either context_id or pkb_note is required");
}

function sanitizeRelativePaths(values: string[] | undefined): string[] {
  return (values ?? []).filter((value) => isSafeRelativePath(value));
}

function isSafeRelativePath(value: string): boolean {
  if (!value || isAbsolute(value) || win32.isAbsolute(value)) {
    return false;
  }

  return value
    .split(/[\\/]+/)
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}
