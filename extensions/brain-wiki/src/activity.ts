import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "./config.ts";
import { buildRegistry, scanWikiPages } from "./indexer.ts";
import { GRACE_PERIODS } from "./lifecycle.ts";
import { readEvents } from "./log.ts";
import { draftsDir, metaPath } from "./paths.ts";
import type { LifecycleBacklog, ListItem, ListItemCategory, ListMdData, WikiEvent } from "./types.ts";

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
    listItems: ListItem[];
    listMdAnalysis: ListMdData;
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
  lifecycle: LifecycleBacklog;
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
      scanDirForChanges(draftsDir(root), sinceMs),
      parseListMd(vaultRoot),
    ]);

    const listMdAnalysis = buildListMdData(listItems);

    vaultActivity = {
      recentProjectChanges: projectChanges,
      recentResourceChanges: resourceChanges,
      recentDraftChanges: draftChanges,
      listItems,
      listMdAnalysis,
    };

    projects = await scanProjectFrontmatter(vaultRoot);

    // Git log (best-effort)
    gitLog = await getGitLog(vaultRoot, since);
  }

  const lifecycle = await computeLifecycleBacklog(root);

  return {
    period: { since, until },
    wikiActivity,
    lifecycle,
    vaultActivity,
    projects,
    gitLog,
  };
}

// ── Lifecycle backlog ──

async function computeLifecycleBacklog(root: string): Promise<LifecycleBacklog> {
  const pages = await scanWikiPages(root);
  const registry = buildRegistry(pages);

  const now = Date.now();

  const integratedAwaitingRecall: LifecycleBacklog["integratedAwaitingRecall"] = [];

  for (const entry of registry.pages) {
    if (entry.status === "integrated" && entry.updated) {
      const daysSince = (now - new Date(entry.updated).getTime()) / 86_400_000;
      if (daysSince >= GRACE_PERIODS.integrated_to_consumed) {
        integratedAwaitingRecall.push({
          path: entry.path,
          title: entry.title,
          status: entry.status,
          integratedAt: entry.updated,
          daysSinceIntegration: Math.floor(daysSince),
        });
      }
    }
  }

  const clearableCandidates: LifecycleBacklog["clearableCandidates"] = [];
  for (const entry of registry.pages) {
    if (entry.status === "archived") {
      clearableCandidates.push({
        path: entry.path,
        title: entry.title,
        reason: "no-active-links",
      });
    }
  }

  const openEdges: LifecycleBacklog["openEdges"] = [];
  for (const entry of registry.pages) {
    for (const edge of entry.edges) {
      if (edge.state === "resolved") continue;
      const created = edge.created ?? entry.updated;
      const createdMs = created ? new Date(created).getTime() : NaN;
      openEdges.push({
        path: entry.path,
        title: entry.title,
        edgeId: edge.id,
        text: edge.text,
        state: edge.state,
        daysSinceCreated: Number.isNaN(createdMs) ? 0 : Math.max(0, Math.floor((now - createdMs) / 86_400_000)),
      });
    }
  }
  openEdges.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);

  return {
    integratedAwaitingRecall,
    consumedReactivated: [],
    clearableCandidates,
    openEdges,
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

const AGENT_LINE_RE = /^  A \d{4}-\d{2}-\d{2}T\d{2}:\d{2} → /;

function detectCategory(text: string): ListItemCategory {
  const lower = text.toLowerCase();
  // URL → source candidate
  if (/https?:\/\//.test(text)) return "source";
  // Explicit prefixes
  if (/^todo:/i.test(text)) return "task";
  if (/^idea/i.test(text)) return "idea";
  if (/^plan/i.test(text)) return "plan";
  // Meeting mentions
  if (/\b(meeting|standup|sync|retro|review|1-1|one-on-one)\b/i.test(text)) return "meeting-note";
  // Task-like patterns
  if (/\b(todo|task|fix|update|submit|review|complete|finish|send|prepare|draft|schedule)\b/i.test(text)) return "task";
  return "unknown";
}

async function parseListMd(vaultRoot: string): Promise<ListItem[]> {
  try {
    const content = await readFile(join(vaultRoot, "LIST.md"), "utf8");
    const items: ListItem[] = [];
    let currentDate = "";
    const now = Date.now();

    for (const line of content.split("\n")) {
      // Match **YYYY-MM-DD** (primary) or ## [YYYY-MM-DD] (backward compat)
      const dateMatch = line.match(/^\*{2}(\d{4}-\d{2}-\d{2})\*{2}/) || line.match(/^##\s*\[(\d{4}-\d{2}-\d{2})\]/);
      if (dateMatch) {
        currentDate = dateMatch[1];
        continue;
      }

      // Agent line — capture as note on the current item
      if (AGENT_LINE_RE.test(line) && items.length > 0) {
        items[items.length - 1].agentNotes.push(line.trim());
        continue;
      }

      // Top-level user item: - [ ], - [x], - [>]
      const taskMatch = line.match(/^-\s*\[([ x>])\]\s*(.+)/);
      if (taskMatch && currentDate) {
        const text = taskMatch[2].trim();
        const rawDate = new Date(currentDate);
        const daysSince = Math.floor((now - rawDate.getTime()) / 86_400_000);
        items.push({
          date: currentDate,
          text,
          done: taskMatch[1] === "x",
          inProgress: taskMatch[1] === ">",
          category: detectCategory(text),
          agentNotes: [],
          daysSinceCreation: daysSince,
        });
        continue;
      }
    }
    return items;
  } catch {
    return [];
  }
}

function buildListMdData(items: ListItem[]): ListMdData {
  const unprocessedItems = items.filter((item) => !item.done);

  // Oldest unprocessed date
  let oldestUnprocessedDate: string | null = null;
  for (const item of unprocessedItems) {
    if (!oldestUnprocessedDate || item.date < oldestUnprocessedDate) {
      oldestUnprocessedDate = item.date;
    }
  }

  // Items containing URLs that haven't been processed
  const unprocessedSourceUrls = unprocessedItems.filter((item) => item.category === "source");

  return {
    items,
    unprocessedItems,
    oldestUnprocessedDate,
    unprocessedSourceUrls,
  };
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
