import { resolve } from "node:path";
import { loadConfig, loadLocalEnvConfig } from "./config.ts";
import { isPathWithinRepo } from "./context-gather-agent.ts";
import { normalizePkbNotePath } from "./context-guide.ts";
import { maybeResolveWikiRoot, normalizeUserPath } from "./paths.ts";

export interface ExternalRepoAccessBlock {
  contextId: string;
  label: string;
  repoPath: string;
  toolName: string;
  targetPath?: string;
}

export async function analyzeExternalRepoAccess(
  cwd: string,
  toolName: string,
  input: unknown,
): Promise<ExternalRepoAccessBlock | null> {
  const root = await maybeResolveWikiRoot(cwd);
  if (!root) {
    return null;
  }

  const protectedTools = new Set(["read", "grep", "find", "ls", "bash"]);
  if (!protectedTools.has(toolName)) {
    return null;
  }

  const config = await loadConfig(root);
  const env = await loadLocalEnvConfig(root);
  const targetPaths = extractToolPaths(toolName, input, cwd);
  if (targetPaths.length === 0) {
    return null;
  }

  for (const [contextId, context] of Object.entries(config.contexts)) {
    const repoPath = env.repos[context.repo_key];
    if (!repoPath) {
      continue;
    }

    for (const targetPath of targetPaths) {
      if (isPathWithinRepo(repoPath, targetPath)) {
        return {
          contextId,
          label: context.label,
          repoPath,
          toolName,
          targetPath,
        };
      }
    }
  }

  return null;
}

export function formatExternalRepoAccessBlock(block: ExternalRepoAccessBlock): string {
  const target = block.targetPath ? ` (${block.targetPath})` : "";
  return [
    `Blocked direct ${block.toolName} access to external context repository "${block.label}"${target}.`,
    `Use wiki_context_gather({ context_id: "${block.contextId}", intent: "overview" | "architecture" | "implementation" | "question" }) instead.`,
    "wiki_context_gather runs an isolated repo agent that follows the target repository's AGENTS.md and local skills.",
    "Do not read or search the external repository directly from the parent wiki session.",
  ].join(" ");
}

function extractToolPaths(toolName: string, input: unknown, cwd: string): string[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const record = input as Record<string, unknown>;
  const paths = new Set<string>();

  const addPath = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) {
      return;
    }
    paths.add(resolve(cwd, normalizeUserPath(value) ?? value));
  };

  if (toolName === "read" || toolName === "grep" || toolName === "find" || toolName === "ls") {
    addPath(record.path);
    addPath(record.file_path);
    addPath(record.target_directory);
  }

  if (toolName === "bash" && typeof record.command === "string") {
  const command = record.command;
    const absoluteMatches = command.match(/\/(?:Users|home|tmp|var|opt|work|Work|Research)[^\s'"]+/g) ?? [];
    for (const match of absoluteMatches) {
      addPath(match);
    }
  }

  return [...paths];
}
