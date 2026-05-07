# PARA-Aware Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor brain-wiki extension to integrate with PARA vault structure — Wiki becomes a living index over the vault, agent participates in LIST.md/Project/ workflows, Area/ stays human-only.

**Architecture:** Three new tools (`wiki_sync`, `wiki_triage`, `wiki_project_sync`) connect the agent to PARA zones. Write gate enforces zone-based permissions. Obsidian CLI used for all supported operations.

**Tech Stack:** TypeScript, ESM, pi Extension API, gray-matter, Obsidian CLI client

---

## File Structure

### New files
- `extensions/brain-wiki/src/sync.ts` — PARA vault scanner, creates/updates wiki topic pages from vault structure
- `extensions/brain-wiki/src/triage.ts` — LIST.md reader/writer with AI content formatting
- `extensions/brain-wiki/src/project-sync.ts` — Project/ scanner and note-adder

### Modified files
- `extensions/brain-wiki/src/types.ts` — Add types for new tool params/results
- `extensions/brain-wiki/src/config.ts` — Update default protect/allowExternal for PARA zones
- `extensions/brain-wiki/src/guards.ts` — Add Area/ to protected paths
- `extensions/brain-wiki/src/paths.ts` — Add PARA path helpers (vaultRoot, areaPath, etc.)
- `extensions/brain-wiki/src/obsidian-client.ts` — Add methods for PARA operations
- `extensions/brain-wiki/index.ts` — Register new tools, update write gate handler
- `extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md` — Update skill docs
- `Wiki/WIKI_SCHEMA.md` — Update schema docs (in vault, not extension)

---

### Task 1: Update types.ts with new tool types

**Files:**
- Modify: `extensions/brain-wiki/src/types.ts`

- [ ] **Step 1: Add SyncScope type and SyncResult interface**

```typescript
export type SyncScope = "area" | "resource" | "projects" | "all";

export interface SyncResult {
  topicsCreated: number;
  topicsUpdated: number;
  pages: string[];
}
```

- [ ] **Step 2: Add TriageAction type and TriageResult interface**

```typescript
export type TriageAction = "read" | "add" | "suggest" | "flag_stale";

export interface TriageResult {
  analysis?: {
    totalItems: number;
    uncheckedItems: number;
    staleItems: number;
    recentItems: number;
  };
  added?: boolean;
  suggestions?: string[];
}
```

- [ ] **Step 3: Add ProjectSyncAction type and ProjectSyncResult interface**

```typescript
export type ProjectSyncAction = "scan" | "add_note" | "suggest_task";

export interface ProjectSyncResult {
  projects?: Array<{
    path: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    lastAction: string | null;
  }>;
  noteAdded?: boolean;
  taskSuggested?: boolean;
}
```

- [ ] **Step 4: Commit**

```bash
git add extensions/brain-wiki/src/types.ts
git commit -m "feat: add types for wiki_sync, wiki_triage, wiki_project_sync"
```

---

### Task 2: Update config.ts defaults for PARA zones

**Files:**
- Modify: `extensions/brain-wiki/src/config.ts`

- [ ] **Step 1: Update createDefaultConfig protect and allowExternal**

```typescript
export function createDefaultConfig(title: string, domain = "General"): WikiConfig {
  return {
    // ... existing fields ...
    protect: [
      "Area/**",
      "inbox/**",
      "meta/registry.json",
      "meta/backlinks.json",
      "meta/events.jsonl",
      "meta/index.md",
      "meta/log.md",
      "meta/lint-report.md",
    ],
    allowExternal: [
      "../LIST.md",
      "../Project/**",
      "../Resource/**",
      "../Draft/**",
    ],
    // ... rest of config ...
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/src/config.ts
git commit -m "feat: update default config for PARA zone permissions"
```

---

### Task 3: Update guards.ts to enforce Area/ protection

**Files:**
- Modify: `extensions/brain-wiki/src/guards.ts`

- [ ] **Step 1: Update isProtected to check Area/**

The `isProtected` function already checks `inbox/` and generated meta files. Add `Area/` check:

```typescript
function isProtected(root: string, absolutePath: string): boolean {
  const vaultRoot = resolve(root, "..");
  // Protect Area/ (human-only PKB)
  if (isWithin(resolve(vaultRoot, "Area"), absolutePath)) return true;
  // Protect inbox/ (immutable source packets)
  if (isWithin(resolve(root, "inbox"), absolutePath)) return true;
  // Protect generated meta files
  return generatedMetaFiles(root).some((path) => resolve(path) === resolve(absolutePath));
}
```

- [ ] **Step 2: Update analyzeToolMutation to resolve vault-relative paths**

The `allowExternal` patterns use `../` relative to wiki root. The analysis needs to resolve these correctly against the vault root:

```typescript
export function analyzeToolMutation(
  root: string,
  toolName: string,
  input: any,
  cwd: string,
  allowedExternal: string[] = [],
): GuardAnalysis {
  const allPaths = extractPaths(toolName, input, cwd);
  const protectedPaths = allPaths.filter((path) => isProtected(root, path));
  const wikiPaths = allPaths.filter((path) => isWithin(root, path));

  // Resolve allowedExternal relative to wiki root (not vault root)
  const allowedResolved = allowedExternal.map((pattern) => resolve(root, pattern));
  const outsidePaths = allPaths.filter(
    (path) => !isWithin(root, path) && !isProtected(root, path),
  );
  const allowedExternalPaths = outsidePaths.filter((path) =>
    allowedResolved.some((allowed) => {
      // Support glob-like ** patterns
      if (allowed.includes("**")) {
        const prefix = allowed.split("**")[0];
        return resolve(path).startsWith(resolve(prefix));
      }
      return resolve(path) === resolve(allowed);
    }),
  );
  const blockedOutsidePaths = outsidePaths.filter(
    (path) => !allowedResolved.some((allowed) => {
      if (allowed.includes("**")) {
        const prefix = allowed.split("**")[0];
        return resolve(path).startsWith(resolve(prefix));
      }
      return resolve(path) === resolve(allowed);
    }),
  );

  return { allPaths, protectedPaths, wikiPaths, outsidePaths: blockedOutsidePaths, allowedExternalPaths };
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/src/guards.ts
git commit -m "feat: enforce Area/ protection and glob pattern matching in write gate"
```

---

### Task 4: Update paths.ts with PARA helpers

**Files:**
- Modify: `extensions/brain-wiki/src/paths.ts`

- [ ] **Step 1: Add vaultRoot function**

```typescript
export function vaultRoot(wikiRoot: string): string {
  return resolve(wikiRoot, "..");
}
```

- [ ] **Step 2: Add PARA path helpers**

```typescript
export function areaRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Area");
}

export function projectRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Project");
}

export function resourceRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Resource");
}

export function draftRoot(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "Draft");
}

export function listMdPath(wikiRoot: string): string {
  return join(vaultRoot(wikiRoot), "LIST.md");
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/src/paths.ts
git commit -m "feat: add PARA path helper functions"
```

---

### Task 5: Extend ObsidianClient with PARA operations

**Files:**
- Modify: `extensions/brain-wiki/src/obsidian-client.ts`
- Modify: `extensions/brain-wiki/src/types.ts` (add ObsidianClient method types)

- [ ] **Step 1: Add listDir method to ObsidianClient**

```typescript
async listDir(dirPath: string): Promise<Array<{ name: string; isDir: boolean; path: string }>> {
  const raw = await this.exec(["list", dirPath]);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok || !Array.isArray(parsed.data)) {
    throw new Error(`Obsidian list failed for ${dirPath}: ${raw}`);
  }
  return parsed.data;
}
```

- [ ] **Step 2: Add readFile method to ObsidianClient**

```typescript
async readFile(filePath: string): Promise<string> {
  const raw = await this.exec(["read", filePath]);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok || typeof parsed.data !== "string") {
    throw new Error(`Obsidian read failed for ${filePath}: ${raw}`);
  }
  return parsed.data;
}
```

- [ ] **Step 3: Add writeFile method to ObsidianClient**

```typescript
async writeFile(filePath: string, content: string): Promise<void> {
  const raw = await this.exec(["write", filePath], { content });
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian write failed for ${filePath}: ${raw}`);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add extensions/brain-wiki/src/obsidian-client.ts
git commit -m "feat: add listDir, readFile, writeFile to ObsidianClient"
```

---

### Task 6: Create sync.ts — wiki_sync implementation

**Files:**
- Create: `extensions/brain-wiki/src/sync.ts`

- [ ] **Step 1: Create sync.ts with PARA vault scanner**

```typescript
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { slugifyTitle } from "./slug.ts";
import { areaRoot, projectRoot, resourceRoot } from "./paths.ts";
import { ensureCanonicalPage } from "./scaffold.ts";
import type { RegistryData, SyncResult, SyncScope, WikiConfig } from "./types.ts";
import { ObsidianClient } from "./obsidian-client.ts";

interface ParaFolder {
  path: string;
  name: string;
  type: "area" | "resource" | "project";
}

export async function syncParaToWiki(
  root: string,
  config: WikiConfig,
  registry: RegistryData,
  scope: SyncScope,
  client?: ObsidianClient | null,
): Promise<SyncResult> {
  const folders = await scanParaFolders(root, scope, client);
  let topicsCreated = 0;
  let topicsUpdated = 0;
  const pages: string[] = [];

  for (const folder of folders) {
    const result = await ensureCanonicalPage(root, config, registry, {
      type: folder.type === "project" ? "plan" : "topic",
      title: folder.name,
      createIfMissing: true,
    });

    if (result.created) {
      topicsCreated++;
      pages.push(result.path!);
    } else if (result.resolved) {
      topicsUpdated++;
      pages.push(result.path!);
    }
  }

  return { topicsCreated, topicsUpdated, pages };
}

async function scanParaFolders(
  root: string,
  scope: SyncScope,
  client?: ObsidianClient | null,
): Promise<ParaFolder[]> {
  const folders: ParaFolder[] = [];

  if (scope === "area" || scope === "all") {
    const areaFolders = await scanDirectory(areaRoot(root), "area", client);
    folders.push(...areaFolders);
  }

  if (scope === "resource" || scope === "all") {
    const resourceFolders = await scanDirectory(resourceRoot(root), "resource", client);
    folders.push(...resourceFolders);
  }

  if (scope === "projects" || scope === "all") {
    const projectFolders = await scanDirectory(projectRoot(root), "project", client);
    folders.push(...projectFolders);
  }

  return folders;
}

async function scanDirectory(
  dirPath: string,
  type: ParaFolder["type"],
  client?: ObsidianClient | null,
): Promise<ParaFolder[]> {
  const folders: ParaFolder[] = [];

  try {
    let entries: Array<{ name: string; isDir: boolean }>;

    if (client) {
      try {
        const rawEntries = await client.listDir(dirPath);
        entries = rawEntries.map((e) => ({ name: e.name, isDir: e.isDir }));
      } catch {
        // Fallback to filesystem
        entries = await scanDirFilesystem(dirPath);
      }
    } else {
      entries = await scanDirFilesystem(dirPath);
    }

    for (const entry of entries) {
      if (entry.isDir) {
        folders.push({
          path: join(dirPath, entry.name),
          name: entry.name,
          type,
        });
      }
    }
  } catch {
    // Directory may not exist
  }

  return folders;
}

async function scanDirFilesystem(dirPath: string): Promise<Array<{ name: string; isDir: boolean }>> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, isDir: true }));
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/src/sync.ts
git commit -m "feat: create sync.ts — PARA vault scanner for wiki topics"
```

---

### Task 7: Create triage.ts — wiki_triage implementation

**Files:**
- Create: `extensions/brain-wiki/src/triage.ts`

- [ ] **Step 1: Create triage.ts with LIST.md operations**

```typescript
import { readFile, appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { listMdPath } from "./paths.ts";
import type { TriageAction, TriageResult } from "./types.ts";

const AI_INDICATOR = "> 🤖 [AI]";

export async function triageList(
  root: string,
  action: TriageAction,
  content?: string,
): Promise<TriageResult> {
  const listPath = listMdPath(root);

  switch (action) {
    case "read":
      return readList(listPath);
    case "add":
      if (!content) throw new Error("content required for add action");
      return addToList(listPath, content);
    case "suggest":
      return suggestFromList(listPath);
    case "flag_stale":
      return flagStaleItems(listPath);
    default:
      throw new Error(`Unknown triage action: ${action}`);
  }
}

async function readList(listPath: string): Promise<TriageResult> {
  const content = await readFile(listPath, "utf8");
  const items = parseListItems(content);

  const uncheckedItems = items.filter((item) => !item.done);
  const staleItems = uncheckedItems.filter((item) => item.daysSince > 7);
  const recentItems = items.filter((item) => item.daysSince <= 3);

  return {
    analysis: {
      totalItems: items.length,
      uncheckedItems: uncheckedItems.length,
      staleItems: staleItems.length,
      recentItems: recentItems.length,
    },
  };
}

async function addToList(listPath: string, content: string): Promise<TriageResult> {
  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n${AI_INDICATOR} ${content}\n`;

  // Read current content to find today's section
  const current = await readFile(listPath, "utf8");
  const todaySection = `**${today}**`;

  if (current.includes(todaySection)) {
    // Append to today's section
    const lines = current.split("\n");
    const todayIndex = lines.findIndex((line) => line.includes(todaySection));
    if (todayIndex >= 0) {
      // Find the next date section or end of file
      let insertIndex = lines.length;
      for (let i = todayIndex + 1; i < lines.length; i++) {
        if (lines[i].match(/^\*\*\d{4}-\d{2}-\d{2}\*\*/)) {
          insertIndex = i;
          break;
        }
      }
      lines.splice(insertIndex, 0, entry);
      await writeFile(listPath, lines.join("\n"), "utf8");
    }
  } else {
    // Create new today section
    const newSection = `\n---\n\n**${today}**\n${entry}`;
    await appendFile(listPath, newSection, "utf8");
  }

  return { added: true };
}

async function suggestFromList(listPath: string): Promise<TriageResult> {
  const content = await readFile(listPath, "utf8");
  const items = parseListItems(content);

  // Find items with URLs that could be captured
  const urlItems = items.filter((item) =>
    !item.done && /https?:\/\//.test(item.text)
  );

  // Find items that mention projects
  const projectItems = items.filter((item) =>
    !item.done && /\[\[Project\//.test(item.text)
  );

  const suggestions: string[] = [];

  if (urlItems.length > 0) {
    suggestions.push(`Found ${urlItems.length} items with URLs that could be captured as sources.`);
  }

  if (projectItems.length > 0) {
    suggestions.push(`Found ${projectItems.length} items linked to projects.`);
  }

  return { suggestions };
}

async function flagStaleItems(listPath: string): Promise<TriageResult> {
  const content = await readFile(listPath, "utf8");
  const items = parseListItems(content);
  const staleItems = items.filter((item) => !item.done && item.daysSince > 7);

  if (staleItems.length === 0) {
    return { suggestions: ["No stale items found."] };
  }

  const suggestions = staleItems.map((item) =>
    `Stale (${item.daysSince}d): ${item.text.slice(0, 60)}${item.text.length > 60 ? "..." : ""}`
  );

  return { suggestions };
}

interface ListItem {
  date: string;
  text: string;
  done: boolean;
  daysSince: number;
}

function parseListItems(content: string): ListItem[] {
  const items: ListItem[] = [];
  let currentDate = "";
  const now = Date.now();

  for (const line of content.split("\n")) {
    const dateMatch = line.match(/^\*{2}(\d{4}-\d{2}-\d{2})\*{2}/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const taskMatch = line.match(/^-\s*\[([ x>])\]\s*(.+)/);
    if (taskMatch && currentDate) {
      const text = taskMatch[2].trim();
      const rawDate = new Date(currentDate);
      const daysSince = Math.floor((now - rawDate.getTime()) / 86_400_000);
      items.push({
        date: currentDate,
        text,
        done: taskMatch[1] === "x",
        daysSince,
      });
    }
  }

  return items;
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/src/triage.ts
git commit -m "feat: create triage.ts — LIST.md reader/writer with AI formatting"
```

---

### Task 8: Create project-sync.ts — wiki_project_sync implementation

**Files:**
- Create: `extensions/brain-wiki/src/project-sync.ts`

- [ ] **Step 1: Create project-sync.ts with Project/ operations**

```typescript
import { readFile, readdir, appendFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { projectRoot, listMdPath } from "./paths.ts";
import type { ProjectSyncAction, ProjectSyncResult } from "./types.ts";

const AI_INDICATOR = "> 🤖 [AI]";

export async function syncProject(
  root: string,
  action: ProjectSyncAction,
  project?: string,
  content?: string,
): Promise<ProjectSyncResult> {
  const projRoot = projectRoot(root);

  switch (action) {
    case "scan":
      return scanProjects(projRoot);
    case "add_note":
      if (!project || !content) throw new Error("project and content required for add_note");
      return addProjectNote(projRoot, project, content);
    case "suggest_task":
      if (!content) throw new Error("content required for suggest_task");
      return suggestTask(root, content);
    default:
      throw new Error(`Unknown project sync action: ${action}`);
  }
}

async function scanProjects(projRoot: string): Promise<ProjectSyncResult> {
  const projects: ProjectSyncResult["projects"] = [];

  try {
    const entries = await readdir(projRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectPath = join(projRoot, entry.name);
      const indexPath = join(projectPath, "index.md");

      try {
        const content = await readFile(indexPath, "utf8");
        const frontmatter = parseFrontmatter(content);

        projects.push({
          path: relative(projRoot, projectPath),
          title: frontmatter.title ?? entry.name,
          status: frontmatter.status ?? "unknown",
          priority: frontmatter.priority ?? "medium",
          deadline: frontmatter.deadline ?? null,
          lastAction: frontmatter.last_action ?? null,
        });
      } catch {
        // No index.md or unreadable
        projects.push({
          path: relative(projRoot, projectPath),
          title: entry.name,
          status: "unknown",
          priority: "medium",
          deadline: null,
          lastAction: null,
        });
      }
    }
  } catch {
    // Project/ dir may not exist
  }

  return { projects };
}

async function addProjectNote(
  projRoot: string,
  project: string,
  content: string,
): Promise<ProjectSyncResult> {
  const projectDir = join(projRoot, project);
  const notesPath = join(projectDir, "notes.md");

  const today = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${today}\n\n${AI_INDICATOR} ${content}\n`;

  try {
    await appendFile(notesPath, entry, "utf8");
  } catch {
    // Create notes.md if it doesn't exist
    const header = `# ${project} Notes\n`;
    await appendFile(notesPath, header + entry, "utf8");
  }

  return { noteAdded: true };
}

async function suggestTask(root: string, content: string): Promise<ProjectSyncResult> {
  const listPath = listMdPath(root);
  const today = new Date().toISOString().slice(0, 10);
  const entry = `${AI_INDICATOR} Suggested task: ${content}`;

  const current = await readFile(listPath, "utf8");
  const todaySection = `**${today}**`;

  if (current.includes(todaySection)) {
    const lines = current.split("\n");
    const todayIndex = lines.findIndex((line) => line.includes(todaySection));
    if (todayIndex >= 0) {
      let insertIndex = lines.length;
      for (let i = todayIndex + 1; i < lines.length; i++) {
        if (lines[i].match(/^\*\*\d{4}-\d{2}-\d{2}\*\*/)) {
          insertIndex = i;
          break;
        }
      }
      lines.splice(insertIndex, 0, `\n- [ ] ${entry}\n`);
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(listPath, lines.join("\n"), "utf8")
      );
    }
  } else {
    const newSection = `\n---\n\n**${today}**\n\n- [ ] ${entry}\n`;
    await appendFile(listPath, newSection, "utf8");
  }

  return { taskSuggested: true };
}

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, any> = {};
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)/);
    if (kv) {
      result[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/src/project-sync.ts
git commit -m "feat: create project-sync.ts — Project/ scanner and note-adder"
```

---

### Task 9: Register new tools in index.ts

**Files:**
- Modify: `extensions/brain-wiki/index.ts`

- [ ] **Step 1: Add imports for new modules**

Add at the top of the file:

```typescript
import { syncParaToWiki } from "./src/sync.ts";
import { triageList } from "./src/triage.ts";
import { syncProject } from "./src/project-sync.ts";
```

- [ ] **Step 2: Add wiki_sync tool registration**

After the existing tool registrations, add:

```typescript
pi.registerTool({
  name: "wiki_sync",
  label: "Wiki Sync",
  description:
    "Scan PARA vault structure and update wiki topic pages.",
  promptSnippet:
    "Sync PARA vault folders (Area/, Resource/, Project/) into wiki topic pages",
  promptGuidelines: [
    "Use this tool to keep wiki topics in sync with your PARA vault structure.",
    "Run with scope='all' after adding new PARA folders.",
    "Existing topic synthesis content is preserved.",
  ],
  parameters: Type.Object({
    scope: StringEnum(["area", "resource", "projects", "all"] as const),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const root = await resolveWikiRoot(ctx.cwd);
    const config = await loadConfig(root);
    return withRootLock(root, async () => {
      const registry = await loadRegistry(root);
      const client = await getObsidianClient(root);
      const result = await syncParaToWiki(root, config, registry, params.scope, client);

      await appendEvent(root, {
        ts: new Date().toISOString(),
        kind: "refactor",
        title: `Synced ${params.scope} PARA folders to wiki`,
        actor: "extension",
        notes: [
          `created=${result.topicsCreated}`,
          `updated=${result.topicsUpdated}`,
        ],
      });

      await rebuildAllGeneratedArtifacts(root);

      return {
        content: [
          {
            type: "text",
            text: `Synced ${params.scope}: ${result.topicsCreated} created, ${result.topicsUpdated} updated`,
          },
        ],
        details: result,
      };
    });
  },
});
```

- [ ] **Step 3: Add wiki_triage tool registration**

```typescript
pi.registerTool({
  name: "wiki_triage",
  label: "Wiki Triage",
  description:
    "Manage LIST.md as shared routing center between human and agent.",
  promptSnippet:
    "Read, add, suggest, or flag stale items in the vault's LIST.md",
  promptGuidelines: [
    "Use this tool to participate in the human's task inbox.",
    "All AI content must use the '> 🤖 [AI]' prefix.",
    "Never mark items complete or delete items.",
  ],
  parameters: Type.Object({
    action: StringEnum(["read", "add", "suggest", "flag_stale"] as const),
    content: Type.Optional(
      Type.String({ description: "Content for add action" }),
    ),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const root = await resolveWikiRoot(ctx.cwd);
    const result = await triageList(root, params.action, params.content);

    return {
      content: [
        {
          type: "text",
          text: formatTriageResult(params.action, result),
        },
      ],
      details: result,
    };
  },
});
```

- [ ] **Step 4: Add wiki_project_sync tool registration**

```typescript
pi.registerTool({
  name: "wiki_project_sync",
  label: "Wiki Project Sync",
  description:
    "Sync with Project/ folders — scan, add notes, suggest tasks.",
  promptSnippet:
    "Read project status, add research notes, or suggest tasks in LIST.md",
  promptGuidelines: [
    "Use this tool to participate in project workflows.",
    "scan returns all active projects with status.",
    "add_note appends research to project/notes.md.",
    "suggest_task adds to LIST.md with AI indicator.",
  ],
  parameters: Type.Object({
    action: StringEnum(["scan", "add_note", "suggest_task"] as const),
    project: Type.Optional(
      Type.String({ description: "Project folder name" }),
    ),
    content: Type.Optional(
      Type.String({ description: "Note content or task suggestion" }),
    ),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const root = await resolveWikiRoot(ctx.cwd);
    const result = await syncProject(
      root,
      params.action,
      params.project,
      params.content,
    );

    return {
      content: [
        {
          type: "text",
          text: formatProjectSyncResult(params.action, result),
        },
      ],
      details: result,
    };
  },
});
```

- [ ] **Step 5: Add format helpers for new tools**

```typescript
function formatTriageResult(action: string, result: TriageResult): string {
  if (action === "read" && result.analysis) {
    return [
      `LIST.md Analysis:`,
      `Total items: ${result.analysis.totalItems}`,
      `Unchecked: ${result.analysis.uncheckedItems}`,
      `Stale (>7d): ${result.analysis.staleItems}`,
      `Recent (≤3d): ${result.analysis.recentItems}`,
    ].join("\n");
  }
  if (action === "add" && result.added) {
    return "Added to LIST.md with AI indicator.";
  }
  if (result.suggestions) {
    return result.suggestions.join("\n");
  }
  return "Done.";
}

function formatProjectSyncResult(action: string, result: ProjectSyncResult): string {
  if (action === "scan" && result.projects) {
    if (result.projects.length === 0) return "No projects found.";
    return [
      `Projects (${result.projects.length}):`,
      ...result.projects.map(
        (p) =>
          `- ${p.title} [${p.status}] ${p.priority}${p.deadline ? ` (due: ${p.deadline})` : ""}`,
      ),
    ].join("\n");
  }
  if (action === "add_note" && result.noteAdded) {
    return "Research note added to project.";
  }
  if (action === "suggest_task" && result.taskSuggested) {
    return "Task suggestion added to LIST.md.";
  }
  return "Done.";
}
```

- [ ] **Step 6: Commit**

```bash
git add extensions/brain-wiki/index.ts
git commit -m "feat: register wiki_sync, wiki_triage, wiki_project_sync tools"
```

---

### Task 10: Update WIKI_SCHEMA.md with new architecture

**Files:**
- Modify: `Wiki/WIKI_SCHEMA.md` (in the vault, not the extension)

- [ ] **Step 1: Update WIKI_SCHEMA.md**

Add a new section after "Layers":

```markdown
## PARA Integration

This wiki is a knowledge graph layer over the PARA vault:

| Zone | Path | Agent | Human |
|------|------|-------|-------|
| **Human-only** | `Area/` | Read only | Full control |
| **Agent-writable** | `Resource/`, `Draft/` | Can create/edit | Full control |
| **Shared** | `LIST.md`, `Project/` | Can read/write | Full control |
| **Wiki (agent-owned)** | `Wiki/` | Full control | Read/browse |

### LIST.md Rules

- Agent can read, add items, suggest links, flag stale items
- Agent cannot mark items complete or delete items
- All AI content must use blockquote with indicator:
  ```markdown
  > 🤖 [AI] Agent note: ...
  ```

### Project/ Rules

- Agent can read, add research notes, suggest tasks
- Agent cannot create project folders or change project status

### New Tools

- `wiki_sync` — scans PARA folders, creates/updates wiki topic pages
- `wiki_triage` — manages LIST.md as shared routing center
- `wiki_project_sync` — syncs with Project/ folders
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/walker/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain"
git add Wiki/WIKI_SCHEMA.md
git commit -m "docs: update WIKI_SCHEMA.md with PARA-aware architecture"
```

---

### Task 11: Update brain-wiki SKILL.md

**Files:**
- Modify: `extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md`

- [ ] **Step 1: Add PARA integration section to SKILL.md**

Add after the existing tool documentation:

```markdown
## PARA Integration

### Zone Map

| Zone | Path | Agent | Human |
|------|------|-------|-------|
| **Human-only** | `Area/` | Read only | Full control |
| **Agent-writable** | `Resource/`, `Draft/` | Can create/edit | Full control |
| **Shared** | `LIST.md`, `Project/` | Can read/write | Full control |
| **Wiki (agent-owned)** | `Wiki/` | Full control | Read/browse |

### New Tools

- `wiki_sync` — scan PARA vault structure, create/update wiki topic pages
- `wiki_triage` — read/add/suggest/flag_stale in LIST.md
- `wiki_project_sync` — scan/add_note/suggest_task in Project/

### LIST.md AI Content Rule

All agent content in LIST.md must use:
```markdown
> 🤖 [AI] Agent note: ...
```

### Obsidian CLI First

Use Obsidian CLI for all supported operations (move, rename, create, read). Direct filesystem only for unsupported operations.
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md
git commit -m "docs: update brain-wiki SKILL.md with PARA integration"
```

---

### Task 12: Run tests and verify

- [ ] **Step 1: Run existing tests**

```bash
cd /Users/walker/Workshop/pi-brain-wiki
npm test
```

Expected: All existing tests pass.

- [ ] **Step 2: Run type check**

```bash
npm run check
```

Expected: No type errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test/type failures"
```

---

## Summary

| Task | Description | New/Modified |
|------|-------------|--------------|
| 1 | Add types for new tools | Modify types.ts |
| 2 | Update config defaults | Modify config.ts |
| 3 | Enforce Area/ protection | Modify guards.ts |
| 4 | Add PARA path helpers | Modify paths.ts |
| 5 | Extend ObsidianClient | Modify obsidian-client.ts |
| 6 | Create wiki_sync | Create sync.ts |
| 7 | Create wiki_triage | Create triage.ts |
| 8 | Create wiki_project_sync | Create project-sync.ts |
| 9 | Register new tools | Modify index.ts |
| 10 | Update WIKI_SCHEMA.md | Modify vault file |
| 11 | Update SKILL.md | Modify skill doc |
| 12 | Run tests and verify | Run tests |
