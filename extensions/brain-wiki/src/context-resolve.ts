import { access } from "node:fs/promises";
import { isAbsolute } from "node:path";
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

  try {
    await access(repoPath);
  } catch {
    throw new Error(`Configured repo path does not exist for repo key "${context.repo_key}"`);
  }

  return {
    context_id: contextId,
    label: context.label,
    pkb_note: context.pkb_note,
    repo_key: context.repo_key,
    repo_path: repoPath,
    allowed_intents: [...context.allowed_intents],
    seed_files: [...(context.seed_files ?? [])],
    include_paths: [...(context.include_paths ?? [])],
    exclude_paths: [...(context.exclude_paths ?? [])],
    search_terms: [...(context.search_terms ?? [])],
    notes: context.notes,
  };
}

function resolveContextEntry(
  contexts: Record<string, ExternalContextConfig>,
  input: ResolveExternalContextInput,
): [string, ExternalContextConfig] {
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
