# Obsidian CLI Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all brain-wiki operations to use Obsidian CLI instead of direct filesystem access, enabling live graph queries, auto-updating links, and Obsidian-native features.

**Architecture:** Extend ObsidianClient with all CLI commands, then migrate capture/lint/log/indexer to use CLI with filesystem fallback when Obsidian is not running.

**Tech Stack:** TypeScript, ESM, Obsidian CLI (Unix socket protocol)

---

## File Structure

### Modified files
- `extensions/brain-wiki/src/obsidian-client.ts` — Add all CLI command methods
- `extensions/brain-wiki/src/capture.ts` — Use `create` for file writes
- `extensions/brain-wiki/src/lint.ts` — Use `unresolved/orphans/deadends` for graph checks
- `extensions/brain-wiki/src/log.ts` — Use `append` for events.jsonl
- `extensions/brain-wiki/src/indexer.ts` — Use `backlinks/links/properties` for graph data
- `extensions/brain-wiki/src/frontmatter.ts` — Use `property:set/read` for frontmatter
- `extensions/brain-wiki/index.ts` — Pass ObsidianClient to all tool handlers

---

### Task 1: Extend ObsidianClient with file operation commands

**Files:**
- Modify: `extensions/brain-wiki/src/obsidian-client.ts`

- [ ] **Step 1: Add create method**

```typescript
async create(
  path: string,
  content?: string,
  options?: { template?: string; overwrite?: boolean; open?: boolean }
): Promise<void> {
  const params: Record<string, string | boolean> = {};
  if (content !== undefined) params.content = content;
  if (options?.template) params.template = options.template;
  if (options?.overwrite) params.overwrite = true;
  if (options?.open) params.open = true;

  const raw = await this.exec(["create", path], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian create failed for ${path}: ${raw}`);
  }
}
```

- [ ] **Step 2: Add append method**

```typescript
async append(
  path: string,
  content: string,
  options?: { inline?: boolean }
): Promise<void> {
  const params: Record<string, string | boolean> = { content };
  if (options?.inline) params.inline = true;

  const raw = await this.exec(["append", path], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian append failed for ${path}: ${raw}`);
  }
}
```

- [ ] **Step 3: Add prepend method**

```typescript
async prepend(
  path: string,
  content: string,
  options?: { inline?: boolean }
): Promise<void> {
  const params: Record<string, string | boolean> = { content };
  if (options?.inline) params.inline = true;

  const raw = await this.exec(["prepend", path], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian prepend failed for ${path}: ${raw}`);
  }
}
```

- [ ] **Step 4: Add move method**

```typescript
async move(from: string, to: string): Promise<void> {
  const raw = await this.exec(["move", from], { to });
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian move failed for ${from} -> ${to}: ${raw}`);
  }
}
```

- [ ] **Step 5: Add rename method**

```typescript
async rename(path: string, name: string): Promise<void> {
  const raw = await this.exec(["rename", path], { name });
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian rename failed for ${path}: ${raw}`);
  }
}
```

- [ ] **Step 6: Add delete method**

```typescript
async delete(path: string, permanent = false): Promise<void> {
  const params: Record<string, string | boolean> = {};
  if (permanent) params.permanent = true;

  const raw = await this.exec(["delete", path], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian delete failed for ${path}: ${raw}`);
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add extensions/brain-wiki/src/obsidian-client.ts
git commit -m "feat: add file operation commands to ObsidianClient"
```

---

### Task 2: Extend ObsidianClient with graph lint commands

**Files:**
- Modify: `extensions/brain-wiki/src/obsidian-client.ts`

- [ ] **Step 1: Add unresolved method**

```typescript
async unresolved(options?: {
  total?: boolean;
  counts?: boolean;
  verbose?: boolean;
  format?: "json" | "tsv" | "csv";
}): Promise<any[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.total) params.total = true;
  if (options?.counts) params.counts = true;
  if (options?.verbose) params.verbose = true;
  if (options?.format) params.format = options.format;

  const raw = await this.exec(["unresolved"], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian unresolved failed: ${raw}`);
  }
  return parsed.data ?? [];
}
```

- [ ] **Step 2: Add orphans method**

```typescript
async orphans(options?: { total?: boolean }): Promise<string[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.total) params.total = true;

  const raw = await this.exec(["orphans"], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian orphans failed: ${raw}`);
  }
  return parsed.data ?? [];
}
```

- [ ] **Step 3: Add deadends method**

```typescript
async deadends(options?: { total?: boolean }): Promise<string[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.total) params.total = true;

  const raw = await this.exec(["deadends"], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian deadends failed: ${raw}`);
  }
  return parsed.data ?? [];
}
```

- [ ] **Step 4: Commit**

```bash
git add extensions/brain-wiki/src/obsidian-client.ts
git commit -m "feat: add graph lint commands to ObsidianClient"
```

---

### Task 3: Extend ObsidianClient with property commands

**Files:**
- Modify: `extensions/brain-wiki/src/obsidian-client.ts`

- [ ] **Step 1: Add propertySet method**

```typescript
async propertySet(
  file: string,
  name: string,
  value: string,
  type?: "text" | "list" | "number" | "checkbox" | "date" | "datetime"
): Promise<void> {
  const params: Record<string, string | boolean> = { name, value };
  if (type) params.type = type;

  const raw = await this.exec(["property:set", file], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian property:set failed for ${file}: ${raw}`);
  }
}
```

- [ ] **Step 2: Add propertyRead method**

```typescript
async propertyRead(file: string, name: string): Promise<any> {
  const raw = await this.exec(["property:read", file], { name });
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian property:read failed for ${file}: ${raw}`);
  }
  return parsed.data;
}
```

- [ ] **Step 3: Add properties method**

```typescript
async properties(file: string, options?: {
  format?: "yaml" | "json" | "tsv";
  counts?: boolean;
}): Promise<Record<string, any>> {
  const params: Record<string, string | boolean> = {};
  if (options?.format) params.format = options.format;
  if (options?.counts) params.counts = true;

  const raw = await this.exec(["properties", file], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian properties failed for ${file}: ${raw}`);
  }
  return parsed.data ?? {};
}
```

- [ ] **Step 4: Commit**

```bash
git add extensions/brain-wiki/src/obsidian-client.ts
git commit -m "feat: add property commands to ObsidianClient"
```

---

### Task 4: Extend ObsidianClient with search and template commands

**Files:**
- Modify: `extensions/brain-wiki/src/obsidian-client.ts`

- [ ] **Step 1: Add search method**

```typescript
async search(query: string, options?: {
  path?: string;
  limit?: number;
  format?: "text" | "json";
  case?: boolean;
  total?: boolean;
}): Promise<any> {
  const params: Record<string, string | boolean> = {};
  if (options?.path) params.path = options.path;
  if (options?.limit) params.limit = String(options.limit);
  if (options?.format) params.format = options.format;
  if (options?.case) params.case = true;
  if (options?.total) params.total = true;

  const raw = await this.exec(["search", query], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian search failed for "${query}": ${raw}`);
  }
  return parsed.data ?? [];
}
```

- [ ] **Step 2: Add templateRead method**

```typescript
async templateRead(name: string, options?: {
  resolve?: boolean;
  title?: string;
}): Promise<string> {
  const params: Record<string, string | boolean> = {};
  if (options?.resolve) params.resolve = true;
  if (options?.title) params.title = options.title;

  const raw = await this.exec(["template:read", name], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok || typeof parsed.data !== "string") {
    throw new Error(`Obsidian template:read failed for "${name}": ${raw}`);
  }
  return parsed.data;
}
```

- [ ] **Step 3: Add files method**

```typescript
async files(options?: {
  folder?: string;
  ext?: string;
  total?: boolean;
}): Promise<string[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.folder) params.folder = options.folder;
  if (options?.ext) params.ext = options.ext;
  if (options?.total) params.total = true;

  const raw = await this.exec(["files"], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian files failed: ${raw}`);
  }
  return parsed.data ?? [];
}
```

- [ ] **Step 4: Add folders method**

```typescript
async folders(options?: {
  folder?: string;
  total?: boolean;
}): Promise<string[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.folder) params.folder = options.folder;
  if (options?.total) params.total = true;

  const raw = await this.exec(["folders"], params);
  const parsed = JSON.parse(raw);
  if (!parsed?.ok) {
    throw new Error(`Obsidian folders failed: ${raw}`);
  }
  return parsed.data ?? [];
}
```

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/obsidian-client.ts
git commit -m "feat: add search, template, files, folders commands to ObsidianClient"
```

---

### Task 5: Migrate log.ts to use Obsidian CLI append

**Files:**
- Modify: `extensions/brain-wiki/src/log.ts`
- Modify: `extensions/brain-wiki/index.ts` (pass ObsidianClient to log functions)

- [ ] **Step 1: Update appendEvent to accept ObsidianClient**

```typescript
export async function appendEvent(
  root: string,
  event: WikiEvent,
  client?: ObsidianClient | null
): Promise<void> {
  const eventsPath = metaPath(root, "events.jsonl");
  const eventLine = JSON.stringify(event);

  if (client) {
    try {
      await client.append(eventsPath, eventLine);
      return;
    } catch {
      // Fallback to filesystem
    }
  }

  // Fallback: read-modify-write
  await mkdir(join(root, "meta"), { recursive: true });
  const existing = await readEvents(root);
  existing.push(event);
  await writeFile(eventsPath, `${existing.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}
```

- [ ] **Step 2: Update index.ts to pass client to appendEvent calls**

Find all calls to `appendEvent(root, ...)` and change to `appendEvent(root, ..., client)`.

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/src/log.ts extensions/brain-wiki/index.ts
git commit -m "feat: migrate log.ts to use Obsidian CLI append"
```

---

### Task 6: Migrate lint.ts to use Obsidian CLI graph commands

**Files:**
- Modify: `extensions/brain-wiki/src/lint.ts`
- Modify: `extensions/brain-wiki/index.ts` (pass ObsidianClient to lint)

- [ ] **Step 1: Update runLint to accept ObsidianClient**

```typescript
export async function runLint(
  root: string,
  mode: string,
  writeReport = false,
  limit?: number,
  client?: ObsidianClient | null
): Promise<LintRun> {
  const pages = await scanWikiPages(root);
  const registry = buildRegistry(pages);
  const backlinks = buildBacklinks(registry);

  const allIssues: LintIssue[] = [];

  if (mode === "links" || mode === "all") {
    if (client) {
      try {
        allIssues.push(...await lintLinksViaCLI(root, client));
      } catch {
        allIssues.push(...lintLinks(pages, registry));
      }
    } else {
      allIssues.push(...lintLinks(pages, registry));
    }
  }

  if (mode === "orphans" || mode === "all") {
    if (client) {
      try {
        allIssues.push(...await lintOrphansViaCLI(root, client));
      } catch {
        allIssues.push(...lintOrphans(registry, backlinks));
      }
    } else {
      allIssues.push(...lintOrphans(registry, backlinks));
    }
  }

  // Keep existing implementations for other modes
  if (mode === "frontmatter" || mode === "all") allIssues.push(...lintFrontmatter(pages));
  if (mode === "duplicates" || mode === "all") allIssues.push(...lintDuplicates(registry));
  if (mode === "coverage" || mode === "all") allIssues.push(...lintCoverage(registry, backlinks));
  if (mode === "staleness" || mode === "all") allIssues.push(...lintStaleness(registry));
  if (mode === "staleness" || mode === "all") allIssues.push(...lintStaleConsumed(registry, backlinks));

  // ... rest of implementation
}
```

- [ ] **Step 2: Add CLI-based lint helpers**

```typescript
async function lintLinksViaCLI(root: string, client: ObsidianClient): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const unresolved = await client.unresolved({ format: "json", verbose: true });

  for (const entry of unresolved) {
    if (typeof entry === "object" && entry.link && entry.sources) {
      for (const source of entry.sources) {
        issues.push({
          kind: "broken-link",
          severity: "error",
          path: source,
          message: `Unresolved link: ${entry.link}`,
        });
      }
    }
  }

  return issues;
}

async function lintOrphansViaCLI(root: string, client: ObsidianClient): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const orphans = await client.orphans();

  for (const orphan of orphans) {
    // Only report wiki pages
    if (orphan.startsWith("Wiki/")) {
      issues.push({
        kind: "orphan",
        severity: "warning",
        path: orphan,
        message: "No incoming links from any vault page",
      });
    }
  }

  return issues;
}
```

- [ ] **Step 3: Update index.ts to pass client to runLint**

- [ ] **Step 4: Commit**

```bash
git add extensions/brain-wiki/src/lint.ts extensions/brain-wiki/index.ts
git commit -m "feat: migrate lint.ts to use Obsidian CLI graph commands"
```

---

### Task 7: Migrate capture.ts to use Obsidian CLI create

**Files:**
- Modify: `extensions/brain-wiki/src/capture.ts`
- Modify: `extensions/brain-wiki/index.ts` (pass ObsidianClient to capture)

- [ ] **Step 1: Update captureSource to accept ObsidianClient**

```typescript
export async function captureSource(
  root: string,
  cwd: string,
  config: WikiConfig,
  params: CaptureParams,
  runner: CommandRunner,
  signal?: AbortSignal,
  client?: ObsidianClient | null,
): Promise<CaptureResult> {
  // ... existing logic for sourceId, packetDir, etc.

  // Use CLI for file writes if available
  const writeFileFn = client
    ? async (path: string, content: string) => client.create(path, content, { overwrite: true })
    : async (path: string, content: string) => writeFile(path, content, "utf8");

  // Use writeFileFn for all file writes
  await writeFileFn(extractedPath, ensureTrailingNewline(captured.extractedMarkdown));
  await writeFileFn(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // ... rest of implementation
}
```

- [ ] **Step 2: Update index.ts to pass client to captureSource**

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/src/capture.ts extensions/brain-wiki/index.ts
git commit -m "feat: migrate capture.ts to use Obsidian CLI create"
```

---

### Task 8: Migrate frontmatter.ts to use Obsidian CLI properties

**Files:**
- Modify: `extensions/brain-wiki/src/frontmatter.ts`
- Modify: `extensions/brain-wiki/index.ts` (pass ObsidianClient to frontmatter functions)

- [ ] **Step 1: Add CLI-based property helpers**

```typescript
export async function setPageProperty(
  absolutePath: string,
  name: string,
  value: any,
  client?: ObsidianClient | null
): Promise<void> {
  if (client) {
    try {
      const type = inferPropertyType(value);
      await client.propertySet(absolutePath, name, String(value), type);
      return;
    } catch {
      // Fallback to gray-matter
    }
  }

  // Fallback: use gray-matter
  const page = await parsePage("", absolutePath);
  page.frontmatter[name] = value;
  await writePage(absolutePath, page.frontmatter, page.body);
}

function inferPropertyType(value: any): "text" | "list" | "number" | "checkbox" | "date" {
  if (Array.isArray(value)) return "list";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "checkbox";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return "date";
  return "text";
}
```

- [ ] **Step 2: Update markPageStatus in log.ts to use CLI**

```typescript
export async function markPageStatus(
  root: string,
  pagePaths: string[],
  status: string,
  extraFields: Record<string, any>,
  client?: ObsidianClient | null,
): Promise<void> {
  for (const relativePath of pagePaths) {
    const absolutePath = join(root, relativePath);

    if (client) {
      try {
        await client.propertySet(absolutePath, "status", status, "text");
        await client.propertySet(absolutePath, "updated", todayStamp(new Date()), "date");
        for (const [key, value] of Object.entries(extraFields)) {
          if (value !== undefined) {
            await setPageProperty(absolutePath, key, value, client);
          }
        }
        continue;
      } catch {
        // Fallback to gray-matter
      }
    }

    // Fallback: use gray-matter
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
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/src/frontmatter.ts extensions/brain-wiki/src/log.ts
git commit -m "feat: migrate frontmatter.ts to use Obsidian CLI properties"
```

---

### Task 9: Update index.ts to pass ObsidianClient to all handlers

**Files:**
- Modify: `extensions/brain-wiki/index.ts`

- [ ] **Step 1: Update all tool handlers to pass client**

Ensure all calls to:
- `appendEvent(root, event)` → `appendEvent(root, event, client)`
- `runLint(root, mode, writeReport, limit)` → `runLint(root, mode, writeReport, limit, client)`
- `captureSource(root, cwd, config, params, runner, signal)` → `captureSource(root, cwd, config, params, runner, signal, client)`
- `markPageStatus(root, pagePaths, status, extraFields)` → `markPageStatus(root, pagePaths, status, extraFields, client)`

- [ ] **Step 2: Commit**

```bash
git add extensions/brain-wiki/index.ts
git commit -m "feat: pass ObsidianClient to all tool handlers"
```

---

### Task 10: Run tests and verify

- [ ] **Step 1: Run type check**

```bash
cd /Users/walker/Workshop/pi-brain-wiki
npm run check
```

Expected: No type errors.

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test/type failures"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add file operation commands | obsidian-client.ts |
| 2 | Add graph lint commands | obsidian-client.ts |
| 3 | Add property commands | obsidian-client.ts |
| 4 | Add search/template/files/folders commands | obsidian-client.ts |
| 5 | Migrate log.ts to use CLI append | log.ts, index.ts |
| 6 | Migrate lint.ts to use CLI graph commands | lint.ts, index.ts |
| 7 | Migrate capture.ts to use CLI create | capture.ts, index.ts |
| 8 | Migrate frontmatter.ts to use CLI properties | frontmatter.ts, log.ts |
| 9 | Update index.ts to pass ObsidianClient | index.ts |
| 10 | Run tests and verify | — |

## Migration Strategy

Every CLI call includes a fallback to the current filesystem implementation:
1. Try CLI first
2. If CLI fails (Obsidian not running), fall back to filesystem
3. No data loss risk
