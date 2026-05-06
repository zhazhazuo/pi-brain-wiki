# Wiki Lifecycle System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consumed/archived/cleared statuses, search filtering, lifecycle-aware lint, consumed marking command, lifecycle backlog tracking in activity scans, and a Recall skill — giving wiki knowledge a clean lifecycle from capture to PKB residency.

**Architecture:** Status-driven lifecycle using frontmatter fields (no folder moves). Recall is a skill prompt, not a new agent. PKB references use vault-relative paths stored as `pkb_refs` arrays. Reactivation flips `consumed` → `integrated` when new sources arrive. All tool changes are small, targeted additions to existing modules.

**Tech Stack:** TypeScript, Node.js, pi extension API, @sinclair/typebox

---

## File Structure

**Modified files:**
- `extensions/brain-wiki/src/types.ts` — add new status values, event kinds, lifecycle fields
- `extensions/brain-wiki/src/search.ts` — filter archived/cleared by default, add `includeArchived` param
- `extensions/brain-wiki/src/lint.ts` — skip archived/cleared, validate consumed frontmatter, add stale-consumed check
- `extensions/brain-wiki/src/log.ts` — handle `consumed`/`archived`/`cleared` events, update frontmatter for consumed
- `extensions/brain-wiki/src/activity.ts` — add lifecycle backlog fields to `ActivityResult`
- `extensions/brain-wiki/src/scaffold.ts` — update templates with `consumed_at` and `pkb_refs` fields
- `extensions/brain-wiki/index.ts` — register `/wiki-consumed` command, add `includeArchived` to search, update status/activity formatters, add new event kinds

**New files:**
- `extensions/brain-wiki/resources/skills/recall/SKILL.md` — Recall skill prompt

---

### Task 1: Update types with lifecycle statuses, event kinds, and fields

**Files:**
- Modify: `extensions/brain-wiki/src/types.ts`

- [ ] **Step 1: Add consumed and cleared to SourceManifest.status union**

In `types.ts`, find the `SourceManifest` interface and update the `status` field:

```typescript
// Before:
status: "captured" | "integrated" | "superseded" | "archived";

// After:
status: "captured" | "integrated" | "superseded" | "archived" | "consumed" | "cleared";
```

- [ ] **Step 2: Add consumed, archived, cleared to WikiEventKind**

In `types.ts`, find the `WikiEventKind` union and add the new kinds:

```typescript
// Before:
export type WikiEventKind =
  | "capture"
  | "integrate"
  | "query"
  | "plan"
  | "review"
  | "lint"
  | "refactor"
  | "rebuild";

// After:
export type WikiEventKind =
  | "capture"
  | "integrate"
  | "query"
  | "plan"
  | "review"
  | "lint"
  | "refactor"
  | "rebuild"
  | "consumed"
  | "archived"
  | "cleared";
```

- [ ] **Step 3: Add consumed_at and pkb_refs to RegistryEntry**

In `types.ts`, find the `RegistryEntry` interface and add the new optional fields after the `sourceIds` field:

```typescript
  sourceIds: string[];
  consumed_at?: string;
  pkb_refs?: string[];
  linksOut: string[];
```

- [ ] **Step 4: Add lifecycle fields to StatusSummary**

In `types.ts`, find the `StatusSummary` interface and add lifecycle counts inside the `sources` object, plus an `oldestIntegrated` field:

```typescript
// Before:
export interface StatusSummary {
  totals: {
    allPages: number;
    summary: number;
    topic: number;
    plan: number;
    review: number;
  };
  sources: {
    captured: number;
    integrated: number;
    unintegrated: number;
  };
  lastCapture?: string;
  lastEvent?: string;
}

// After:
export interface StatusSummary {
  totals: {
    allPages: number;
    summary: number;
    topic: number;
    plan: number;
    review: number;
  };
  sources: {
    captured: number;
    integrated: number;
    unintegrated: number;
    consumed: number;
    archived: number;
    cleared: number;
  };
  lastCapture?: string;
  lastEvent?: string;
  oldestIntegrated?: string;
}
```

- [ ] **Step 5: Add LifecycleBacklog interface and add it to ActivityResult**

In `types.ts`, add a new interface after `ActivityResult` (in `activity.ts` we'll import it). Actually, add it right after `StatusSummary`:

```typescript
export interface LifecycleBacklog {
  integratedAwaitingRecall: Array<{ path: string; title: string; status: string; integratedAt?: string; daysSinceIntegration: number }>;
  consumedReactivated: Array<{ path: string; title: string; consumedAt: string; newSourceIds: string[] }>;
  clearableCandidates: Array<{ path: string; title: string; reason: "pkb-covered" | "superseded" | "no-active-links"; pkbRefs?: string[] }>;
}
```

Then find `ActivityResult` and add a `lifecycle` field:

```typescript
export interface ActivityResult {
  period: { since: string; until: string };
  wikiActivity: {
    recentEvents: WikiEvent[];
    recentPageChanges: string[];
    totalPages: number;
    pagesByStatus: Record<string, number>;
  };
  lifecycle: LifecycleBacklog;
  vaultActivity?: { ... };  // unchanged
  projects?: Array<{ ... }>;  // unchanged
  gitLog?: { ... } | null;   // unchanged
}
```

- [ ] **Step 6: Commit**

```bash
git add extensions/brain-wiki/src/types.ts
git commit -m "feat(lifecycle): add consumed/cleared statuses, event kinds, and registry fields"
```

---

### Task 2: Filter archived/cleared from search by default

**Files:**
- Modify: `extensions/brain-wiki/src/search.ts`
- Modify: `extensions/brain-wiki/index.ts` (search tool parameters)

- [ ] **Step 1: Add excludeStatuses parameter to searchRegistry**

In `search.ts`, update the `searchRegistry` function signature to accept an `excludeStatuses` parameter with a default value:

```typescript
// Before:
export async function searchRegistry(
  root: string,
  registry: RegistryData,
  query: string,
  type?: WikiPageType,
  limit?: number,
): Promise<SearchResult> {

// After:
export async function searchRegistry(
  root: string,
  registry: RegistryData,
  query: string,
  type?: WikiPageType,
  limit?: number,
  excludeStatuses?: string[],
): Promise<SearchResult> {
```

- [ ] **Step 2: Apply status filter before scoring**

In `search.ts`, find the `.filter()` call that filters by type and add the status filter. The existing line is:

```typescript
  const matches = registry.pages
    .filter((entry) => !type || entry.type === type)
```

Change it to:

```typescript
  const matches = registry.pages
    .filter((entry) => !type || entry.type === type)
    .filter((entry) => {
      if (!excludeStatuses || excludeStatuses.length === 0) return true;
      return !excludeStatuses.includes(entry.status ?? "");
    })
```

- [ ] **Step 3: Add includeArchived parameter to wiki_search tool in index.ts**

In `index.ts`, find the `wiki_search` tool registration and update its `parameters` to add `includeArchived`:

```typescript
// In the parameters Type.Object, add:
    includeArchived: Type.Optional(
      Type.Boolean({
        description: "Include archived and cleared entries in results (default: false)",
      }),
    ),
```

- [ ] **Step 4: Pass excludeStatuses to searchRegistry call**

In `index.ts`, find the `wiki_search` execute handler. Currently:

```typescript
  const result = await searchRegistry(
    root,
    registry,
    params.query,
    params.type as WikiPageType | undefined,
    params.limit,
  );
```

Change it to:

```typescript
  const excludeStatuses = params.includeArchived
    ? []
    : ["archived", "cleared"];
  const result = await searchRegistry(
    root,
    registry,
    params.query,
    params.type as WikiPageType | undefined,
    params.limit,
    excludeStatuses,
  );
```

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/search.ts extensions/brain-wiki/index.ts
git commit -m "feat(lifecycle): exclude archived/cleared from search by default, add includeArchived param"
```

---

### Task 3: Update lint to skip archived/cleared, validate consumed frontmatter, detect stale consumed

**Files:**
- Modify: `extensions/brain-wiki/src/lint.ts`

- [ ] **Step 1: Add isArchivedOrCleared helper**

At the top of `lint.ts` (after the FRONTMATTER_REQUIRED constant), add:

```typescript
function isArchivedOrCleared(page: ParsedPage | RegistryData["pages"][number]): boolean {
  const status = ("frontmatter" in page ? page.frontmatter.status : page.status) ?? "";
  return status === "archived" || status === "cleared";
}
```

- [ ] **Step 2: Skip archived/cleared in all lint checks**

For `lintLinks`: filter out archived/cleared pages from the `known` set and skip checks on those pages. Find:

```typescript
function lintLinks(pages: ParsedPage[], registry: RegistryData): LintIssue[] {
  const known = new Set(registry.pages.map((page) => page.path));
  const issues: LintIssue[] = [];

  for (const page of pages) {
```

Change to:

```typescript
function lintLinks(pages: ParsedPage[], registry: RegistryData): LintIssue[] {
  const known = new Set(registry.pages.filter((p) => !isArchivedOrCleared(p)).map((page) => page.path));
  const hiddenSet = new Set(registry.pages.filter((p) => isArchivedOrCleared(p)).map((page) => page.path));
  const issues: LintIssue[] = [];

  for (const page of pages) {
    if (isArchivedOrCleared(page)) continue;
```

For `lintOrphans`: find:

```typescript
function lintOrphans(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  return registry.pages
    .filter((page) => page.type === "topic")
```

Change to:

```typescript
function lintOrphans(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  return registry.pages
    .filter((page) => page.type === "topic" && !isArchivedOrCleared(page))
```

For `lintFrontmatter`: find:

```typescript
function lintFrontmatter(pages: ParsedPage[]): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const page of pages) {
```

Add after `for (const page of pages) {`:

```typescript
    if (isArchivedOrCleared(page)) continue;
```

For `lintDuplicates`: find:

```typescript
  for (const page of registry.pages.filter((entry) => entry.type === "topic")) {
```

Change to:

```typescript
  for (const page of registry.pages.filter((entry) => entry.type === "topic" && !isArchivedOrCleared(entry))) {
```

For `lintCoverage`: find:

```typescript
function lintCoverage(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const page of registry.pages) {
```

Add after `for (const page of registry.pages) {`:

```typescript
    if (isArchivedOrCleared(page)) continue;
```

For `lintStaleness`: find:

```typescript
function lintStaleness(registry: RegistryData): LintIssue[] {
  return registry.pages.flatMap((page) => {
```

Change to:

```typescript
function lintStaleness(registry: RegistryData): LintIssue[] {
  return registry.pages.flatMap((page) => {
    if (isArchivedOrCleared(page)) return [];
```

- [ ] **Step 3: Add consumed frontmatter validation**

In `lintFrontmatter`, after the existing required-field checks loop, add validation for `consumed` pages. Find the closing brace of the `for (const page of pages)` loop and add before it:

```typescript
    // Validate consumed pages have consumed_at and pkb_refs
    if (String(page.frontmatter.status) === "consumed") {
      if (!Object.prototype.hasOwnProperty.call(page.frontmatter, "consumed_at")) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: "Consumed page is missing consumed_at field.",
        });
      }
      if (!Object.prototype.hasOwnProperty.call(page.frontmatter, "pkb_refs") || !Array.isArray(page.frontmatter.pkb_refs) || page.frontmatter.pkb_refs.length === 0) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: "Consumed page is missing pkb_refs field or it is empty.",
        });
      }
    }
```

- [ ] **Step 4: Add stale-consumed check (consumed topic with new integrated sources)**

Add a new lint function after `lintStaleness`:

```typescript
function lintStaleConsumed(registry: RegistryData, backlinks: BacklinksData): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const page of registry.pages) {
    if (page.status !== "consumed") continue;
    const record = backlinks.byPath[page.path];
    if (!record) continue;
    // Check if any inbound page is integrated (new source pointing at consumed topic)
    const inboundIntegrated = record.inbound.filter((inPath) => {
      const inboundPage = registry.pages.find((p) => p.path === inPath);
      return inboundPage && inboundPage.status === "integrated";
    });
    if (inboundIntegrated.length > 0) {
      issues.push({
        kind: "staleness",
        severity: "warning",
        path: page.path,
        message: `Consumed page has ${inboundIntegrated.length} newly integrated source(s) pointing at it. Consider reactivation (flip to integrated).`,
      });
    }
  }
  return issues;
}
```

- [ ] **Step 5: Wire stale-consumed into runLint**

In `runLint`, add the new check to the `all` mode and the `staleness` mode. Find:

```typescript
  if (mode === "staleness" || mode === "all") allIssues.push(...lintStaleness(registry));
```

Add after it:

```typescript
  if (mode === "staleness" || mode === "all") allIssues.push(...lintStaleConsumed(registry, backlinks));
```

- [ ] **Step 6: Commit**

```bash
git add extensions/brain-wiki/src/lint.ts
git commit -m "feat(lifecycle): skip archived/cleared in lint, validate consumed frontmatter, detect stale consumed"
```

---

### Task 4: Handle consumed/archived/cleared events in log, update frontmatter

**Files:**
- Modify: `extensions/brain-wiki/src/log.ts`

- [ ] **Step 1: Add markPageStatus helper**

In `log.ts`, add a helper function after `markSourcesIntegrated` that updates a page's status and any lifecycle fields. This generalizes the pattern from `markSourcesIntegrated`:

```typescript
export async function markPageStatus(
  root: string,
  pagePaths: string[],
  status: string,
  extraFields: Record<string, any>,
): Promise<void> {
  for (const relativePath of pagePaths) {
    const absolutePath = join(root, relativePath);
    try {
      const page = await parsePage(root, absolutePath);
      await writePage(
        absolutePath,
        {
          ...page.frontmatter,
          status,
          updated: todayStamp(new Date()),
          ...extraFields,
        },
        page.body,
      );
    } catch {
      // Skip pages that don't exist or can't be parsed
    }
  }
}
```

- [ ] **Step 2: Add consumed/archived/cleared handling to the event flow**

In `index.ts`, the `wiki_log_event` tool handler already handles `kind === "integrate"` with special logic. Add similar handling for the new kinds. Find the block after `if (params.kind === "integrate" && params.sourceIds?.length) {` and add after the closing brace:

```typescript
        if (params.kind === "consumed" && params.pagePaths?.length) {
          const ts = new Date().toISOString();
          await markPageStatus(root, params.pagePaths, "consumed", {
            consumed_at: ts,
            pkb_refs: params.notes ?? [],
          });
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "archived" && params.pagePaths?.length) {
          await markPageStatus(root, params.pagePaths, "archived", {});
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "cleared" && params.pagePaths?.length) {
          await markPageStatus(root, params.pagePaths, "cleared", {
            cleared_at: new Date().toISOString(),
          });
          await rebuildAllGeneratedArtifacts(root);
        }
```

Wait — the `pkb_refs` data should come from a structured field, not from `notes`. Let me reconsider. The consumed event needs `pkb_refs` as a first-class parameter. Let me update the tool parameters in index.ts as well.

Actually, review the current event structure. `WikiEvent` has `notes: string[]`. For consumed events, `notes` could hold the `pkb_refs`. But that's mixing concerns. Better to add the `pkb_refs` via the notes field convention for now: the first elements of `notes` starting with `pkb_ref:` are pkb refs.

Actually, simpler: add `extraFields` to the `wiki_log_event` tool parameters so the caller can pass consumed-specific data. But that's over-engineering.

Simplest approach: the `notes` array is used to carry the `pkb_refs` values for consumed events. The markPageStatus for consumed events will look for notes starting with `pkb:` prefix.

Let me revise Step 2:

```typescript
        if (params.kind === "consumed" && params.pagePaths?.length) {
          const pkbRefs = (params.notes ?? []).filter((n) => n.startsWith("pkb:")).map((n) => n.slice(4));
          const ts = new Date().toISOString();
          await markPageStatus(root, params.pagePaths, "consumed", {
            consumed_at: ts,
            pkb_refs: pkbRefs.length > 0 ? pkbRefs : undefined,
          });
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "archived" && params.pagePaths?.length) {
          await markPageStatus(root, params.pagePaths, "archived", {});
          await rebuildAllGeneratedArtifacts(root);
        } else if (params.kind === "cleared" && params.pagePaths?.length) {
          await markPageStatus(root, params.pagePaths, "cleared", {
            cleared_at: new Date().toISOString(),
          });
          await rebuildAllGeneratedArtifacts(root);
        }
```

- [ ] **Step 3: Import markPageStatus in index.ts**

In `index.ts`, find the import lines from `./src/log.ts` and add `markPageStatus`:

```typescript
// Before:
import {
  appendEvent,
  markSourcesIntegrated,
  readEvents,
  rebuildLog,
} from "./src/log.ts";

// After:
import {
  appendEvent,
  markPageStatus,
  markSourcesIntegrated,
  readEvents,
  rebuildLog,
} from "./src/log.ts";
```

- [ ] **Step 4: Update EVENT_KIND_ENUM in index.ts**

Find `EVENT_KIND_ENUM` and add the new kinds:

```typescript
// Before:
const EVENT_KIND_ENUM = StringEnum([
  "capture",
  "integrate",
  "query",
  "plan",
  "review",
  "lint",
  "refactor",
  "rebuild",
] as const);

// After:
const EVENT_KIND_ENUM = StringEnum([
  "capture",
  "integrate",
  "query",
  "plan",
  "review",
  "lint",
  "refactor",
  "rebuild",
  "consumed",
  "archived",
  "cleared",
] as const);
```

- [ ] **Step 5: Add import for parsePage and writePage in log.ts**

In `log.ts`, find the import from `./frontmatter.ts` and add `parsePage`:

```typescript
// Before:
import { parsePage, writePage } from "./frontmatter.ts";

// This already imports parsePage! Let me check...
```

Actually, looking at the current `log.ts`, it only imports `parsePage` and `writePage` from frontmatter. Let me check: the current import line is:

```typescript
import { parsePage, writePage } from "./frontmatter.ts";
```

Great, both are already imported. The `markSourcesIntegrated` function already uses `parsePage` and `writePage`. The new `markPageStatus` function will use them too.

But wait — `markPageStatus` needs `parsePage` which takes `root` and `absolutePath`, and the input paths are relative. Let me re-check: `parsePage` takes `root` and `absolutePath`. But the `relativePath` from pagePaths would need to be resolved. Actually, looking at `markSourcesIntegrated`, it constructs the full path using `join(root, "pages", "summaries", ...)`. The `markPageStatus` creates absolute paths using `join(root, relativePath)`. That should work since pagePaths are stored as relative to root (like `pages/summaries/2026-05-06-Source.md`).

Let me also check if `parsePage` needs an absolute path. Looking at the function:

```typescript
export async function parsePage(root: string, absolutePath: string): Promise<ParsedPage> {
```

It takes an absolute path. So in `markPageStatus`, we need `join(root, relativePath)` which gives an absolute path. That's correct.

But wait — `markSourcesIntegrated` iterates source IDs and finds matching summary pages by scanning the directory. The `markPageStatus` takes pagePaths directly. The `relativePath` values in `WikiEvent.pagePaths` are like `pages/summaries/2026-05-06-Source.md`. So `join(root, relativePath)` gives the correct absolute path. Good.

- [ ] **Step 6: Commit**

```bash
git add extensions/brain-wiki/src/log.ts extensions/brain-wiki/index.ts
git commit -m "feat(lifecycle): handle consumed/archived/cleared events, mark page frontmatter"
```

---

### Task 5: Update activity scan with lifecycle backlog data

**Files:**
- Modify: `extensions/brain-wiki/src/activity.ts`

- [ ] **Step 1: Add lifecycle backlog computation to scanActivity**

In `activity.ts`, find the `scanPageStatuses` function. Add a new function after it:

```typescript
async function computeLifecycleBacklog(root: string): Promise<import("./types.ts").LifecycleBacklog> {
  const { pages } = await readRegistry(root);
  const now = Date.now();
  const twoWeeksMs = 14 * 86_400_000;

  const integratedAwaitingRecall: import("./types.ts").LifecycleBacklog["integratedAwaitingRecall"] = [];
  const consumedReactivated: import("./types.ts").LifecycleBacklog["consumedReactivated"] = [];

  for (const page of pages) {
    if (page.status === "integrated" && page.updated) {
      const daysSince = (now - new Date(page.updated).getTime()) / 86_400_000;
      if (daysSince >= 14) {
        integratedAwaitingRecall.push({
          path: page.path,
          title: page.title,
          status: page.status,
          integratedAt: page.updated,
          daysSinceIntegration: Math.floor(daysSince),
        });
      }
    }
    if (page.status === "consumed" && page.consumed_at) {
      // Check for re-activation: consumed pages with newly integrated sources
      // This is a simplified check; full re-activation detection requires backlinks
      // which we don't have here. The lint check handles this comprehensively.
    }
  }

  // Clearable candidates: archived pages with no inbound links from active pages
  // We need backlinks for this, but activity scan doesn't currently load them
  // For now, just list archived pages
  const clearableCandidates: import("./types.ts").LifecycleBacklog["clearableCandidates"] = [];
  for (const page of pages) {
    if (page.status === "archived") {
      clearableCandidates.push({
        path: page.path,
        title: page.title,
        reason: "no-active-links" as const,
      });
    }
  }

  return {
    integratedAwaitingRecall,
    consumedReactivated: [],
    clearableCandidates,
  };
}
```

Wait, I need to think about this more carefully. The `scanActivity` function doesn't have access to the registry or backlinks — it scans the filesystem directly. I need to load the registry to compute backlog data. Let me restructure.

- [ ] **Step 1 (revised): Add lifecycle backlog computation to scanActivity**

In `activity.ts`, add an import for the registry loader. Then add a function that reads the registry and computes backlog data.

At the top of `activity.ts`, add the import:

```typescript
import { buildRegistry, scanWikiPages } from "./indexer.ts";
import type { LifecycleBacklog } from "./types.ts";
```

Then add the computation function before `scanActivity`:

```typescript
async function computeLifecycleBacklog(root: string): Promise<LifecycleBacklog> {
  const pages = await scanWikiPages(root);
  const registry = buildRegistry(pages);

  const now = Date.now();
  const twoWeeksMs = 14 * 86_400_000;

  const integratedAwaitingRecall: LifecycleBacklog["integratedAwaitingRecall"] = [];
  const consumedReactivated: LifecycleBacklog["consumedReactivated"] = [];

  for (const entry of registry.pages) {
    if (entry.status === "integrated" && entry.updated) {
      const daysSince = (now - new Date(entry.updated).getTime()) / 86_400_000;
      if (daysSince >= 14) {
        integratedAwaitingRecall.push({
          path: entry.path,
          title: entry.title,
          status: entry.status,
          integratedAt: entry.updated,
          daysSinceIntegration: Math.floor(daysSince),
        });
      }
    }
    // consumed reactivated detection needs backlinks — handled by lint
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

  return {
    integratedAwaitingRecall,
    consumedReactivated,
    clearableCandidates,
  };
}
```

- [ ] **Step 2: Add lifecycle field to ActivityResult returned from scanActivity**

In `scanActivity`, after the `wikiActivity` object is constructed, add the lifecycle computation. Find:

```typescript
  const wikiActivity: ActivityResult["wikiActivity"] = {
    recentEvents,
    recentPageChanges: pageChanges,
    totalPages,
    pagesByStatus,
  };
```

After it, add:

```typescript
  const lifecycle = await computeLifecycleBacklog(root);
```

- [ ] **Step 3: Add lifecycle to the return value**

In `scanActivity`, find the return statement and add `lifecycle`:

```typescript
  return {
    period: { since, until },
    wikiActivity,
    lifecycle,
    vaultActivity,
    projects,
    gitLog,
  };
```

- [ ] **Step 4: Update formatActivity in index.ts to include lifecycle data**

In `index.ts`, find the `formatActivity` function. After the git log section, add:

```typescript
  // Lifecycle backlog
  if (result.lifecycle) {
    lines.push(`\nLifecycle backlog:`);
    if (result.lifecycle.integratedAwaitingRecall.length > 0) {
      lines.push(`  Awaiting Recall: ${result.lifecycle.integratedAwaitingRecall.length} entries`);
      for (const entry of result.lifecycle.integratedAwaitingRecall.slice(0, 5)) {
        lines.push(`    - ${entry.title} (${entry.daysSinceIntegration}d since integration)`);
      }
    } else {
      lines.push(`  Awaiting Recall: none`);
    }
    if (result.lifecycle.consumedReactivated.length > 0) {
      lines.push(`  Reactivated (consumed with new sources): ${result.lifecycle.consumedReactivated.length} entries`);
    }
    if (result.lifecycle.clearableCandidates.length > 0) {
      lines.push(`  Clearable: ${result.lifecycle.clearableCandidates.length} archived entries`);
    } else {
      lines.push(`  Clearable: none`);
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/activity.ts extensions/brain-wiki/index.ts
git commit -m "feat(lifecycle): add lifecycle backlog data to activity scan"
```

---

### Task 6: Update wiki_status with lifecycle counts

**Files:**
- Modify: `extensions/brain-wiki/index.ts` (buildStatus and formatStatus functions)

- [ ] **Step 1: Add consumed/archived/cleared counts to buildStatus**

In `index.ts`, find the `buildStatus` function. After the `integrated` count, add lifecycle counts:

```typescript
  const consumed = sources.filter((page) => page.status === "consumed").length;
  const archived = sources.filter((page) => page.status === "archived").length;
  const cleared = sources.filter((page) => page.status === "cleared").length;

  // Find oldest integrated entry
  const integratedEntries = sources.filter((page) => page.status === "integrated" && page.updated);
  const oldestIntegrated = integratedEntries.length > 0
    ? integratedEntries.reduce((oldest, entry) => entry.updated! < oldest ? entry.updated! : oldest, integratedEntries[0].updated!)
    : undefined;
```

Then update the return to include them:

```typescript
  return {
    totals,
    sources: {
      captured,
      integrated,
      unintegrated: captured,
      consumed,
      archived,
      cleared,
    },
    lastCapture: [...events].reverse().find((event) => event.kind === "capture")?.ts,
    lastEvent: events.at(-1)?.ts,
    oldestIntegrated,
  };
```

- [ ] **Step 2: Update formatStatus to include lifecycle counts**

In `index.ts`, find `formatStatus`. Currently:

```typescript
function formatStatus(status: StatusSummary): string {
  return [
    `Pages: ${status.totals.allPages} total (${status.totals.summary} summary, ${status.totals.topic} topic, ${status.totals.plan} plan, ${status.totals.review} review)`,
    `Sources: ${status.sources.captured} captured, ${status.sources.integrated} integrated, ${status.sources.unintegrated} unintegrated`,
    ...(status.lastCapture ? [`Last capture: ${status.lastCapture}`] : []),
    ...(status.lastEvent ? [`Last event: ${status.lastEvent}`] : []),
  ].join("\n");
}
```

Replace with:

```typescript
function formatStatus(status: StatusSummary): string {
  return [
    `Pages: ${status.totals.allPages} total (${status.totals.summary} summary, ${status.totals.topic} topic, ${status.totals.plan} plan, ${status.totals.review} review)`,
    `Sources: ${status.sources.captured} captured, ${status.sources.integrated} integrated, ${status.sources.consumed} consumed, ${status.sources.archived} archived, ${status.sources.cleared} cleared`,
    ...(status.oldestIntegrated ? [`Oldest unintegrated: ${status.oldestIntegrated}`] : []),
    ...(status.lastCapture ? [`Last capture: ${status.lastCapture}`] : []),
    ...(status.lastEvent ? [`Last event: ${status.lastEvent}`] : []),
  ].join("\n");
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/index.ts
git commit -m "feat(lifecycle): add consumed/archived/cleared counts and oldestIntegrated to wiki_status"
```

---

### Task 7: Add /wiki-consumed command

**Files:**
- Modify: `extensions/brain-wiki/index.ts`

- [ ] **Step 1: Register the /wiki-consumed command**

In `index.ts`, after the `wiki-rebuild` command registration, add:

```typescript
  pi.registerCommand("wiki-consumed", {
    description: "Mark wiki pages as consumed by PKB. Usage: /wiki-consumed <page-path> <pkb-ref-1> [pkb-ref-2] ...",
    handler: async (args, ctx) => {
      const root = await resolveWikiRoot(ctx.cwd);
      const parts = (args ?? "").trim().split(/\s+/);
      if (parts.length < 2 || !parts[0] || parts.length < 2) {
        ctx.ui.notify("Usage: /wiki-consumed <page-path> <pkb-ref-1> [pkb-ref-2] ...", "warning");
        return;
      }
      const pagePath = parts[0];
      const pkbRefs = parts.slice(1);

      return withRootLock(root, async () => {
        const ts = new Date().toISOString();
        await appendEvent(root, {
          ts,
          kind: "consumed",
          title: `Consumed ${pagePath}`,
          pagePaths: [pagePath],
          notes: pkbRefs.map((ref) => `pkb:${ref}`),
          actor: "user",
        });
        await markPageStatus(root, [pagePath], "consumed", {
          consumed_at: ts,
          pkb_refs: pkbRefs,
        });
        await rebuildAllGeneratedArtifacts(root);
        ctx.ui.notify(`Marked ${pagePath} as consumed (PKB: ${pkbRefs.join(", ")})`, "info");
      });
    },
  });
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/index.ts
git commit -m "feat(lifecycle): add /wiki-consumed command for marking pages consumed by PKB"
```

---

### Task 8: Update page templates with lifecycle frontmatter fields

**Files:**
- Modify: `extensions/brain-wiki/src/scaffold.ts`

- [ ] **Step 1: Add consumed_at and pkb_refs to summary template**

In `scaffold.ts`, find `DEFAULT_SUMMARY_TEMPLATE` and add the new fields after `integrated_at:`:

```yaml
# Before:
integrated_at:
origin_type: {{origin_type}}

# After:
integrated_at:
consumed_at:
pkb_refs:
origin_type: {{origin_type}}
```

- [ ] **Step 2: Add consumed_at and pkb_refs to topic template**

In `scaffold.ts`, find `DEFAULT_TOPIC_TEMPLATE` and add the new fields after `source_ids: []`:

```yaml
# Before:
source_ids: []
summary:

# After:
source_ids: []
consumed_at:
pkb_refs:
summary:
```

- [ ] **Step 3: Update frontmatter required fields in lint.ts**

Wait — this is about the template, not lint. The lint already validates consumed pages separately in Task 3. No overlap.

- [ ] **Step 4: Commit**

```bash
git add extensions/brain-wiki/src/scaffold.ts
git commit -m "feat(lifecycle): add consumed_at and pkb_refs fields to page templates"
```

---

### Task 9: Add RegistryEntry lifecycle fields to the indexer

**Files:**
- Modify: `extensions/brain-wiki/src/indexer.ts`

- [ ] **Step 1: Add consumed_at and pkb_refs to RegistryEntry building**

In `indexer.ts`, find the `buildRegistry` function and the entry construction. Currently:

```typescript
  const entries: RegistryEntry[] = pages.map((page) => {
    const type = String(page.frontmatter.type || inferTypeFromPath(page.relativePath)) as WikiPageType;
    return {
      id: String(page.frontmatter.id ?? page.relativePath),
      type,
      path: page.relativePath,
      title: String(page.frontmatter.title ?? page.relativePath),
      aliases: arrayOfStrings(page.frontmatter.aliases),
      summary: typeof page.frontmatter.summary === "string" ? page.frontmatter.summary : undefined,
      status: typeof page.frontmatter.status === "string" ? page.frontmatter.status : undefined,
      tags: arrayOfStrings(page.frontmatter.tags),
      updated: typeof page.frontmatter.updated === "string" ? page.frontmatter.updated : undefined,
      sourceIds: arrayOfStrings(page.frontmatter.source_ids),
      linksOut: [...new Set(page.normalizedLinks)],
      headings: page.headings,
      wordCount: page.wordCount,
    };
  });
```

Add the new fields after `sourceIds`:

```typescript
      sourceIds: arrayOfStrings(page.frontmatter.source_ids),
      consumed_at: typeof page.frontmatter.consumed_at === "string" && page.frontmatter.consumed_at ? page.frontmatter.consumed_at : undefined,
      pkb_refs: arrayOfStrings(page.frontmatter.pkb_refs).length > 0 ? arrayOfStrings(page.frontmatter.pkb_refs) : undefined,
      linksOut: [...new Set(page.normalizedLinks)],
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/src/indexer.ts
git commit -m "feat(lifecycle): include consumed_at and pkb_refs in registry entries"
```

---

### Task 10: Update the wiki-intel skill with lifecycle backlog section

**Files:**
- Modify: `extensions/brain-wiki/resources/skills/wiki-intel/SKILL.md`

- [ ] **Step 1: Add lifecycle backlog section to the Intelligence protocol**

In `wiki-intel/SKILL.md`, find the "For Plan Requests" section. After step 6 ("Read recent wiki events"), add:

```markdown
7. Check lifecycle backlog from `wiki_scan_activity` output:
   - Integrated entries awaiting Recall review (2+ weeks old)
   - Archived entries that may be clearable
   - Consumed topics with new sources (needs reactivation)
```

- [ ] **Step 2: Add lifecycle output format to the output section**

Find the "Review Pages" output format and add a "Lifecycle Backlog" section after "Recommendations":

```markdown
### Lifecycle Backlog (new section for reviews)

#### Awaiting Recall review (integrated → consumed)
- [[summaries/Source-A]] — integrated 16 days ago, no PKB entry found
- [[summaries/Source-B]] — integrated 14 days ago

#### Awaiting clearing (archived → cleared)
- [[summaries/Source-C]] — PKB covered: Resource/1 CS/17 AI/LLM Memory.md
- [[summaries/Source-D]] — no active links

#### Reactivated (consumed with new sources)
- [[topics/Type-Theory]] — new integrated source pointing at consumed topic
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/resources/skills/wiki-intel/SKILL.md
git commit -m "feat(lifecycle): add lifecycle backlog section to Intelligence skill"
```

---

### Task 11: Create the Recall skill

**Files:**
- Create: `extensions/brain-wiki/resources/skills/recall/SKILL.md`

- [ ] **Step 1: Write the Recall skill prompt**

Create the file `extensions/brain-wiki/resources/skills/recall/SKILL.md`:

```markdown
---
name: recall
description: Compare wiki source knowledge against PKB entries to verify coverage, identify gaps, and mark knowledge as consumed. Use when Walker wants to verify that PKB entries fully cover a wiki source or topic.
---

# Recall — Knowledge Verification Skill

You are performing a **Recall session**: comparing wiki knowledge against Walker's PKB (Resource/, Project/, Area/) to verify coverage and identify gaps.

## When to Use

- Walker says "I've internalized this" or "this is in my PKB now"
- Walker wants to compare a wiki source against existing PKB entries
- Walker asks to verify that knowledge has been fully transferred
- Walker wants to mark wiki pages as consumed

## Startup Checklist

Before any Recall session:

1. Load the `brain-wiki` skill (shared rules) — **required**
2. Read `Wiki/WIKI_SCHEMA.md` — conventions and structure
3. Read `Wiki/meta/index.md` — orient to current wiki state

## The Recall Protocol

### Phase 1: Identify the source

Walker provides either:
- A wiki summary or topic page path
- A PKB entry path (find the wiki entries that informed it)
- A topic area (find all entries in that area awaiting Recall)

If Walker provides a PKB path, use `wiki_search` to find the wiki entries that relate to it.

If Walker provides a topic area, look at `wiki_scan_activity` for lifecycle backlog data to find integrated entries awaiting Recall.

### Phase 2: Read both sides

```
1. Read the wiki source(s) — the summary page and any topic pages it informed
2. Read the PKB entry at the pkb_refs path(s)
   - If the path doesn't exist, search the vault for similar filenames using the `bash` tool
   - If still not found, flag this: "PKB entry not found. Walker may need to create it."
```

### Phase 3: Compare and produce a gap list

Read the wiki source carefully. For each significant claim, fact, or concept:

1. **Covered:** The PKB entry already contains this information (or a close equivalent)
2. **Gap:** The wiki source says something the PKB doesn't cover
3. **Drift:** The PKB says something different from the wiki source
4. **Enhancement:** The wiki source has nuance or context that would enrich the PKB

Output format:

```markdown
## Comparison: [Source title] vs [PKB entry]

### Covered (no action needed)
- [Claim from wiki source — already in PKB]

### Gaps (PKB is missing this)
- [Claim from wiki source — not in PKB]

### Drift (PKB differs from wiki source)
- [Wiki says X, PKB says Y]

### Enhancements (PKB would benefit from adding)
- [Nuance or context from wiki source]
```

### Phase 4: Propose PKB edits

For each gap, drift, or enhancement:

1. Propose a specific edit to the PKB entry
2. Use the `edit` tool on the PKB file (Resource/, etc.)
3. Wait for Walker to confirm each edit before applying
4. Never modify wiki pages in this phase — only the PKB

### Phase 5: Mark consumed

After Walker confirms that the knowledge is now in the PKB:

1. Use `wiki_log_event` with `kind: "consumed"`, `pagePaths: [<wiki-page-path>]`, and `notes: ["pkb:<pkb-path>"]` for each PKB entry that covers the source
2. Or use the `/wiki-consumed` command: `/wiki-consumed <page-path> <pkb-path>`

**This step is mandatory, not optional.** Every completed Recall session must end with marking the wiki page as consumed. If Walker declines to mark consumed, note it but don't skip the step — ask again.

### Phase 6: Log

Use `wiki_log_event` with `kind: "consumed"` to record the transition. The event should include:
- `title`: "Consumed [source title]"
- `pagePaths`: the wiki pages marked consumed
- `notes`: `pkb:` prefixed entries for each PKB path
- `actor`: "agent"

## Reactivation

If a wiki page is already `consumed` and a new source has been integrated into the same topic, the topic should be flipped back to `integrated`. This is handled by:

1. Workshop skill: when integrating a new source into a `consumed` topic, flip status back to `integrated` and log a `refactor` event noting the reactivation
2. Lint: `staleness` mode flags `consumed` topics with newly integrated inbound sources

## Clearing Archived Entries

When Walker asks about clearing archived entries:

1. Use `wiki_scan_activity` to get clearable candidates
2. Present each candidate with the reason (PKB-covered, no active links, superseded)
3. For each Walker confirms, use `wiki_log_event` with `kind: "cleared"` and `pagePaths`
4. The page frontmatter will be updated to `status: cleared` with `cleared_at` date

## Rules

1. **Never skip the comparison.** The value of Recall is the gap/drift list, not just the marking.
2. **Never modify wiki content during Recall.** You only modify PKB entries (with confirmation) and wiki status fields.
3. **The consumed marking is mandatory.** If you complete a Recall session and don't mark consumed, you've left the lifecycle incomplete.
4. **Respect PKB structure.** PKB entries are Walker's permanent knowledge. Propose edits carefully, don't restructure.
5. **Search before giving up.** If a PKB path doesn't resolve, search for the filename. PARA paths change.
```

- [ ] **Step 2: Register the skill in index.ts**

In `index.ts`, find the `resources_discover` handler and add the recall skill path:

```typescript
// Before:
    skillPaths: [
      join(skillDir, "brain-wiki", "SKILL.md"),
      join(skillDir, "wiki-map", "SKILL.md"),
      join(skillDir, "wiki-workshop", "SKILL.md"),
      join(skillDir, "wiki-intel", "SKILL.md"),
    ],

// After:
    skillPaths: [
      join(skillDir, "brain-wiki", "SKILL.md"),
      join(skillDir, "wiki-map", "SKILL.md"),
      join(skillDir, "wiki-workshop", "SKILL.md"),
      join(skillDir, "wiki-intel", "SKILL.md"),
      join(skillDir, "recall", "SKILL.md"),
    ],
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/resources/skills/recall/SKILL.md extensions/brain-wiki/index.ts
git commit -m "feat(lifecycle): add Recall skill for knowledge verification and consumed marking"
```

---

### Task 12: Update Workshop skill with reactivation rule

**Files:**
- Modify: `extensions/brain-wiki/resources/skills/wiki-workshop/SKILL.md`

- [ ] **Step 1: Add reactivation rule to Workshop status management**

In `wiki-workshop/SKILL.md`, find the "Status management" section (Rule 8). Add a new row after the "Newer source replaces older" row:

```markdown
| New source integrated into consumed topic | topic → `integrated` (reactivated), log `refactor` event noting reactivation |
```

And add a new rule after Rule 9:

```markdown
### 10. Reactivation rule

When integrating a new source into a topic that is currently `consumed`:

1. Check the topic's status before editing
2. If the topic is `consumed`, flip its status back to `integrated`
3. Add a note to the frontmatter `updated` field with today's date
4. Log a `refactor` event: `wiki_log_event kind=refactor title="Reactivated [topic name]" pagePaths=[topic path] notes=["reactivated-from-consumed"]`
5. Proceed with the integration as normal

This ensures that consumed topics are automatically re-reviewed when new information arrives. The lint `staleness` check catches any consumed topics that were missed.
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/resources/skills/wiki-workshop/SKILL.md
git commit -m "feat(lifecycle): add reactivation rule to Workshop skill"
```

---

### Task 13: Update Map skill with consumed-aware query behavior

**Files:**
- Modify: `extensions/brain-wiki/resources/skills/wiki-map/SKILL.md`

- [ ] **Step 1: Add consumed topic handling to Map protocol**

In `wiki-map/SKILL.md`, find the "Core Protocol: Search → Orient → Dive" section. After the "Found matching topics?" branch, add a note about consumed topics:

After the line that says "Read topic summaries (5-20 lines each)" and before "Enough depth for the question?", add:

```markdown
If a topic is `consumed`, follow its `pkb_refs` to the PKB entry instead of reading the wiki page. The PKB is the source of truth for consumed knowledge. If the PKB entry is missing, flag it: "Topic marked consumed but PKB entry not found at [path]."
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/resources/skills/wiki-map/SKILL.md
git commit -m "feat(lifecycle): add consumed-aware query behavior to Map skill"
```

---

### Task 14: Update brain-wiki shared skill with lifecycle table

**Files:**
- Modify: `extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md`

- [ ] **Step 1: Update the Page Lifecycle section**

Find the existing lifecycle table:

```markdown
| Status | Meaning | When Applied |
|--------|---------|-------------|
| `captured` | Source ingested but not integrated into topics | Auto-set on capture |
| `integrated` | Content woven into wiki; page is authoritative | Set after integration complete |
| `draft` | Topic page exists but not yet authoritative | Set on topic creation |
| `contested` | Two sources openly disagree; resolution pending | Set when contradiction flagged |
| `superseded` | Newer source has replaced this page's claims | Old page kept for provenance |
| `archived` | Retired to Wiki/archive/ | Set on commit-to-KB or when no longer needed |
```

Replace with:

```markdown
| Status | Meaning | When Applied |
|--------|---------|-------------|
| `captured` | Source ingested but not integrated into topics | Auto-set on capture |
| `integrated` | Content woven into wiki; page is authoritative | Set after integration complete |
| `consumed` | Walker has internalized this; PKB is the source of truth | Set via Recall skill or `/wiki-consumed` command |
| `draft` | Topic page exists but not yet authoritative | Set on topic creation |
| `contested` | Two sources openly disagree; resolution pending | Set when contradiction flagged |
| `superseded` | Newer source has replaced this page's claims | Old page kept for provenance |
| `archived` | Retired; excluded from search and lint by default | Set when knowledge is fully in PKB and no longer needed in wiki |
| `cleared` | Removed from wiki; preserved during grace period | Set by Recall/Intelligence when archiving clears old entries |

**Reactivation:** When a new source is integrated into a `consumed` topic, flip the topic back to `integrated`. Consumed is a checkpoint, not a destination.
```

- [ ] **Step 2: Add consumed frontmatter fields documentation**

After the "Frontmatter Conventions" section, add frontmatter field documentation for the new lifecycle fields. Find the summary page frontmatter and add after `source_ids`:

```yaml
  consumed_at:    # ISO date when Walker confirmed internalization (only for consumed status)
  pkb_refs:       # Array of vault-relative paths to PKB entries (only for consumed status)
```

And in the topic page frontmatter, add after `source_ids`:

```yaml
  consumed_at:    # ISO date when Walker confirmed internalization (only for consumed status)
  pkb_refs:       # Array of vault-relative paths to PKB entries (only for consumed status)
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md
git commit -m "feat(lifecycle): update shared skill with full lifecycle table and new frontmatter fields"
```

---

### Task 15: Update the WIKI_SCHEMA.md template

**Files:**
- Modify: `extensions/brain-wiki/src/scaffold.ts` (the `defaultSchemaMarkdown` function)

- [ ] **Step 1: Add lifecycle section to schema**

In `scaffold.ts`, find `defaultSchemaMarkdown`. After the "Integration targets" section and before "## Workflows", add:

```markdown
## Knowledge lifecycle

Pages move through statuses:

\`\`\`
captured → integrated → consumed → archived → cleared
               ↑            │
               └────────────┘  (reactivation on new source)
\`\`\`

| Status | Meaning | Included in search? |
|--------|---------|---------------------|
| `captured` | Source ingested, not yet integrated | Yes |
| `integrated` | Content woven into topics | Yes |
| `consumed` | Walker internalized; PKB is source of truth | Yes (follows pkb_refs) |
| `archived` | Retired | No (override with includeArchived) |
| `cleared` | Removed during grace period | No |

### Consumed pages

When Walker confirms knowledge is in the PKB:
1. Run Recall comparison (or `/wiki-consumed` command)
2. Page status → `consumed`
3. Frontmatter gains `consumed_at` and `pkb_refs`

### Reactivation

If a new source integrates into a consumed topic, the topic flips back to `integrated`. Consumed is a checkpoint, not a destination.
```

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/src/scaffold.ts
git commit -m "feat(lifecycle): add lifecycle section to WIKI_SCHEMA template"
```

---

### Task 16: Update knowledge base docs

**Files:**
- Modify: `docs/04_modules/search.md`
- Modify: `docs/04_modules/lint.md`
- Modify: `docs/04_modules/log.md`
- Modify: `docs/04_modules/activity.md`
- Modify: `docs/04_modules/types.md`
- Create: `docs/superpowers/features/2026-05-06-wiki-lifecycle.md`

- [ ] **Step 1: Update search.md**

In `docs/04_modules/search.md`, add a section about lifecycle filtering:

```markdown
## Lifecycle Filtering

Search excludes `archived` and `cleared` entries by default. Set `includeArchived: true` to include them.

```typescript
// Default: excludes archived/cleared
searchRegistry(root, registry, "functional programming");

// Include everything
searchRegistry(root, registry, "functional programming", undefined, 10, []);
```
```

- [ ] **Step 2: Update lint.md**

In `docs/04_modules/lint.md`, add documentation about the new checks:

```markdown
## Lifecycle-Aware Checks

- `archived` and `cleared` pages are skipped by all lint checks
- `consumed` pages are validated for required `consumed_at` and `pkb_refs` fields
- Staleness check detects `consumed` topics with newly integrated inbound sources (reactivation candidates)
```

- [ ] **Step 3: Update log.md**

In `docs/04_modules/log.md`, add documentation about the new event kinds:

```markdown
## Lifecycle Events

| Kind | Effect |
|------|--------|
| `consumed` | Updates page frontmatter: `status: consumed`, `consumed_at: <timestamp>`, `pkb_refs: [...]`. Notes prefixed `pkb:` provide the PKB paths. |
| `archived` | Updates page frontmatter: `status: archived` |
| `cleared` | Updates page frontmatter: `status: cleared`, `cleared_at: <timestamp>` |
```

- [ ] **Step 4: Update activity.md**

In `docs/04_modules/activity.md`, add documentation about the lifecycle backlog:

```markdown
## Lifecycle Backlog

`wiki_scan_activity` now returns a `lifecycle` object containing:

- `integratedAwaitingRecall`: pages in `integrated` status for 14+ days
- `consumedReactivated`: consumed topics with newly integrated sources
- `clearableCandidates`: archived entries that may be eligible for clearing
```

- [ ] **Step 5: Update types.md**

In `docs/04_modules/types.md`, add documentation about the new types:

```markdown
## Lifecycle Types

| Type | New Fields |
|------|-----------|
| `SourceManifest.status` | Added `"consumed"` and `"cleared"` |
| `WikiEventKind` | Added `"consumed"`, `"archived"`, `"cleared"` |
| `RegistryEntry` | Added `consumed_at?`, `pkb_refs?` |
| `StatusSummary.sources` | Added `consumed`, `archived`, `cleared` |
| `LifecycleBacklog` | New interface for activity scan backlog data |
```

- [ ] **Step 6: Create feature doc**

Create `docs/superpowers/features/2026-05-06-wiki-lifecycle.md`:

```markdown
# Wiki Lifecycle System

> Added: 2026-05-06

## What it does

Gives wiki knowledge a clean lifecycle from first capture to PKB residency. Pages move through statuses: captured → integrated → consumed → archived → cleared, with reactivation support for consumed topics that receive new sources.

## Key changes

- **New statuses:** `consumed` and `cleared` added to the page lifecycle
- **Search filtering:** `wiki_search` excludes archived/cleared by default; `includeArchived` override
- **Lint awareness:** Archived/cleared pages skipped; consumed pages validated for `consumed_at` and `pkb_refs`; stale consumed detected
- **Lifecycle backlog:** `wiki_scan_activity` returns backlog data (awaiting recall, reactivations, clearable)
- **Recall skill:** Comparison workflow for wiki source vs PKB entry
- **`/wiki-consumed` command:** Fast path for marking pages consumed without a full Recall session
- **Reactivation:** Consumed topics flip back to `integrated` when new sources arrive

## Frontmatter fields

New fields for `consumed` status pages:
- `consumed_at`: ISO timestamp
- `pkb_refs`: Array of vault-relative paths to PKB entries

## Event kinds

New `wiki_log_event` kinds: `consumed`, `archived`, `cleared`
```

- [ ] **Step 7: Commit**

```bash
git add docs/04_modules/search.md docs/04_modules/lint.md docs/04_modules/log.md docs/04_modules/activity.md docs/04_modules/types.md docs/superpowers/features/2026-05-06-wiki-lifecycle.md
git commit -m "docs(lifecycle): update module docs and add feature doc"
```

---

### Task 17: Update the original spec to mark it as superseded

**Files:**
- Modify: `docs/superpowers/specs/2026-05-06-wiki-lifecycle-system-design.md`

- [ ] **Step 1: Add superseded header**

At the top of the original spec, add:

```markdown
> **Superseded by:** [Refined design](2026-05-06-wiki-lifecycle-one-pager.md) and [Implementation plan](../plans/2026-05-06-wiki-lifecycle.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-06-wiki-lifecycle-system-design.md
git commit -m "docs(lifecycle): mark original spec as superseded by refined design"
```

---

### Task 18: Build and verify

**Files:**
- None (verification only)

- [ ] **Step 1: Run type check**

```bash
cd /Users/walkerw/Research/pi-brain-wiki && npx tsc --noEmit
```

Expected: No type errors. If there are errors, fix them in the relevant source files.

- [ ] **Step 2: Run the check script**

```bash
cd /Users/walkerw/Research/pi-brain-wiki && npm run check
```

Expected: Passes without errors.

- [ ] **Step 3: Manual smoke test — bootstrap a test wiki**

```bash
cd /tmp && mkdir test-lifecycle-wiki && cd test-lifecycle-wiki
```

Then in a pi session:

```
wiki_bootstrap title="Lifecycle Test Wiki" domain="Testing"
wiki_capture_source inputType=text value="Test source content for lifecycle" title="Lifecycle Test Source"
wiki_search query="Lifecycle"
wiki_lint mode=all
wiki_scan_activity
wiki_status
```

Expected: All tools work. No errors. Lifecycle fields appear in templates.

- [ ] **Step 4: Commit any fixes**

If type checking or testing revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix(lifecycle): address type errors and smoke test issues"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - New statuses (consumed, cleared) → Task 1 (types), Task 4 (log events)
  - Search exclude archived/cleared → Task 2
  - Lint skip archived/cleared, validate consumed → Task 3
  - wiki_log_event new kinds → Task 4
  - wiki_scan_activity lifecycle backlog → Task 5
  - wiki_status lifecycle counts → Task 6
  - /wiki-consumed command → Task 7
  - Recall skill → Task 11
  - Reactivation → Task 12 (Workshop), Task 3 (lint detection)
  - Intelligence lifecycle backlog → Task 10
  - Map consumed-aware → Task 13
  - pkb_refs as array → Task 1, Task 8, Task 9
  - Mandatory consumed marking → Task 11 (Recall skill)
  - Templates with new fields → Task 8
  - Docs update → Task 16, Task 17

- [x] **Placeholder scan:** No TBD/TODO/fill-in-later patterns found

- [x] **Type consistency:** `LifecycleBacklog` defined in types.ts, used in activity.ts. `consumed_at` and `pkb_refs` on `RegistryEntry`, used in indexer.ts. Event kinds match between types.ts and index.ts.