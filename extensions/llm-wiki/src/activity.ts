import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "./config.ts";
import { readEvents } from "./log.ts";
import { metaPath } from "./paths.ts";
import type { WikiEvent } from "./types.ts";

const execAsync = promisify(execFile);

export interface ActivityResult {
  period: { since: string; until: string };
  wikiActivity: {
    recentEvents: WikiEvent[];
    recentPageChanges: string[];
    totalPages: number;
    pagesByStatus: Record<string, number>;
  };
  vaultActivity?: {
    recentProjectChanges: string[];
    recentResourceChanges: string[];
    recentDraftChanges: string[];
    listItems: Array<{ date: string; text: string; done: boolean }>;
  };
  projects?: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    lastAction: string | null;
  }>;
  gitLog?: {
    commits: number;
    summary: string;
  } | null;
}

export interface ActivityParams {
  since?: string;
  scope?: "wiki" | "vault" | "both";
}

export async function scanActivity(root: string, vaultRoot: string, params: ActivityParams): Promise<ActivityResult> {
  const since = params.since ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const scope = params.scope ?? "both";
  const until = new Date().toISOString().slice(0, 10);
  const sinceMs = new Date(since).getTime();

  // ── Wiki Activity ──
  const recentEvents = await scanEvents(root, since);
  const pageChanges = await scanDirForChanges(join(root, "pages"), sinceMs);
  const totalPages = (await scanDirForChanges(join(root, "pages"), 0)).length;
  const pagesByStatus = await scanPageStatuses(root);

  const wikiActivity: ActivityResult["wikiActivity"] = {
    recentEvents,
    recentPageChanges: pageChanges,
    totalPages,
    pagesByStatus,
  };

  // ── Vault Activity ──
  let vaultActivity: ActivityResult["vaultActivity"] | undefined;
  let projects: ActivityResult["projects"] | undefined;
  let gitLog: ActivityResult["gitLog"] = null;

  if (scope === "vault" || scope === "both") {
    const [projectChanges, resourceChanges, draftChanges, listItems] = await Promise.all([
      scanDirForChanges(join(vaultRoot, "Project"), sinceMs),
      scanDirForChanges(join(vaultRoot, "Resource"), sinceMs),
      scanDirForChanges(join(vaultRoot, "Draft"), sinceMs),
      parseListMd(vaultRoot),
    ]);

    vaultActivity = {
      recentProjectChanges: projectChanges,
      recentResourceChanges: resourceChanges,
      recentDraftChanges: draftChanges,
      listItems,
    };

    projects = await scanProjectFrontmatter(vaultRoot);

    // Git log (best-effort)
    gitLog = await getGitLog(vaultRoot, since);
  }

  return {
    period: { since, until },
    wikiActivity,
    vaultActivity,
    projects,
    gitLog,
  };
}

// ── Internal helpers ──

async function scanEvents(root: string, since: string): Promise<WikiEvent[]> {
  const events = await readEvents(root);
  return events.filter((e) => e.ts?.startsWith(since) || e.ts >= since);
}

async function scanDirForChanges(dir: string, sinceMs: number): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    const changed: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const fullPath = join(entry.parentPath ?? dir, entry.name);
      try {
        const fileStat = await stat(fullPath);
        if (fileStat.mtimeMs >= sinceMs) {
          changed.push(fullPath);
        }
      } catch {
        // skip inaccessible files
      }
    }

    return changed.sort();
  } catch {
    return [];
  }
}

async function scanPageStatuses(root: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const pagesDir = join(root, "pages");
  try {
    const typeDirs = await readdir(pagesDir, { withFileTypes: true });
    for (const typeDir of typeDirs) {
      if (!typeDir.isDirectory()) continue;
      const dirPath = join(pagesDir, typeDir.name);
      const files = await readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".md")) continue;
        const fullPath = join(dirPath, file.name);
        try {
          const content = await readFile(fullPath, "utf8");
          const statusMatch = content.match(/^status:\s*(\S+)/m);
          if (statusMatch) {
            const status = statusMatch[1];
            counts[status] = (counts[status] ?? 0) + 1;
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    // pages dir may not exist
  }
  return counts;
}

async function parseListMd(vaultRoot: string): Promise<Array<{ date: string; text: string; done: boolean }>> {
  try {
    const content = await readFile(join(vaultRoot, "LIST.md"), "utf8");
    const items: Array<{ date: string; text: string; done: boolean }> = [];
    let currentDate = "";

    for (const line of content.split("\n")) {
      const dateMatch = line.match(/^##\s*\[(\d{4}-\d{2}-\d{2})\]/);
      if (dateMatch) {
        currentDate = dateMatch[1];
        continue;
      }
      const taskMatch = line.match(/^-\s*\[([ x>])\]\s*(.+)/);
      if (taskMatch && currentDate) {
        items.push({
          date: currentDate,
          text: taskMatch[2].trim(),
          done: taskMatch[1] === "x",
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function scanProjectFrontmatter(vaultRoot: string): Promise<
  Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    lastAction: string | null;
  }>
> {
  const projects: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    lastAction: string | null;
  }> = [];

  try {
    const entries = await readdir(join(vaultRoot, "Project"), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const fullPath = join(vaultRoot, "Project", entry.name);
      try {
        const content = await readFile(fullPath, "utf8");
        const frontmatter = parseFrontmatter(content);
        if (!frontmatter) continue;
        projects.push({
          path: relative(vaultRoot, fullPath),
          title: entry.name.replace(/\.md$/, ""),
          status: String(frontmatter.status ?? "unknown"),
          priority: String(frontmatter.priority ?? "medium"),
          deadline: frontmatter.deadline != null ? String(frontmatter.deadline) : null,
          lastAction: frontmatter.last_action != null ? String(frontmatter.last_action) : null,
        });
      } catch {
        // skip unparseable
      }
    }
  } catch {
    // Project/ dir may not exist
  }

  return projects;
}

async function getGitLog(cwd: string, since: string): Promise<{ commits: number; summary: string } | null> {
  try {
    const { stdout } = await execAsync("git", ["log", `--since=${since}`, "--oneline"], {
      cwd,
      timeout: 5000,
    });
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return { commits: 0, summary: "No commits in this period." };
    return {
      commits: lines.length,
      summary: lines.slice(0, 10).join("\n") + (lines.length > 10 ? `\n... and ${lines.length - 10} more` : ""),
    };
  } catch {
    return null;
  }
}

function parseFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result: Record<string, any> = {};
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)/);
    if (kv) {
      let value: string | string[] = kv[2].trim();
      // Handle YAML arrays: [item1, item2]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map((v) => v.trim().replace(/["']/g, ""));
      }
      // Handle quoted values
      value = value.replace(/^["']|["']$/g, "");
      result[kv[1]] = value;
    }
  }
  return result;
}
