# Module: obsidian-cli

> Integration notes for Obsidian CLI usage in the brain-wiki extension.
> Status: **partially implemented** — core client, IO boundary, search, backlinks, graph lint, page writes, and property updates are active.

## Responsibility

Provides a client layer that delegates vault-visible content, search, graph, and property operations to the Obsidian CLI (running app via Unix socket). Internal .wiki/meta caches and bootstrap state remain filesystem-backed.

## Context

The user's Obsidian vault (`/Users/walkerw/Research/Brain`) has 4404 files across Area/, Project/, Resource/, Archive/, Daily Notes, and Wiki/. The brain-wiki extension manages the Wiki/ subfolder inside this vault.

Obsidian 1.12.7 ships a built-in CLI mode (no plugin needed). When `cli: true` is set in `obsidian.json`, the running app listens on a Unix socket at `~/.obsidian-cli.sock` (macOS/Linux) or a named pipe on Windows. The `obsidian` binary in `$PATH` resolves to the CLI shim at `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`.

**Protocol:** Connect to socket → send `{"argv":["command","arg1",...], "tty": false, "cwd": "..."}\n` → read response.

---

## Architecture

```
brain-wiki extension
│
├── tool handlers (wiki_search, wiki_lint, etc.)
│   └── delegate to ObsidianClient
│         │
│         └── obsidian CLI (Unix socket → running Obsidian app)
│               │
│               ├── search:context  ── full-text search, scoped, with context
│               ├── backlinks       ── live graph query across 4404 files
│               ├── links           ── outgoing links for any file
│               ├── properties      ── read/set/query frontmatter properties
│               ├── file            ── metadata (size, timestamps, extension)
│               ├── tags            ── tag queries
│               ├── create/move/rename/delete  ── file ops (index-safe)
│               ├── template:read   ── template resolution
│               ├── daily:read/append/prepend   ── daily note bridge
│               ├── recents/tabs    ── live awareness
│               ├── diff/history    ── version comparison
│               ├── unresolved/orphans/deadends  ── graph lint
│               └── eval            ── arbitrary JS (nuclear option)
│
├── raw fs writes ──→ guarded writes to Wiki/ (kept for write tool)
└── skills (Map, Workshop, Intelligence)
```

---

## 1. ObsidianClient — the protocol wrapper

### `extensions/brain-wiki/src/obsidian-client.ts`

A thin client that speaks the Obsidian CLI protocol over the Unix socket.

```typescript
interface ObsidianClientConfig {
  socketPath: string;       // default ~/.obsidian-cli.sock
  vaultCwd: string;         // the vault root path
  timeout: number;          // ms, default 10000
}

class ObsidianClient {
  constructor(config: ObsidianClientConfig);
  
  // Raw execution
  async exec(command: string, params?: Record<string, string | boolean>): Promise<string>;
  
  // Typed convenience methods
  async search(query: string, options?: SearchOptions): Promise<SearchResult>;
  async backlinks(file: string, options?: BacklinkOptions): Promise<BacklinkEntry[]>;
  async links(file: string): Promise<string[]>;
  async unresolved(): Promise<UnresolvedLink[]>;
  async orphans(): Promise<string[]>;
  async deadends(): Promise<string[]>;
  async properties(file: string): Promise<Record<string, any>>;
  async propertySet(file: string, name: string, value: any, type?: string): Promise<void>;
  async propertyRead(file: string, name: string): Promise<any>;
  async tags(file?: string): Promise<TagEntry[]>;
  async fileInfo(path: string): Promise<FileInfo>;
  async create(path: string, content?: string, template?: string): Promise<void>;
  async read(path: string): Promise<string>;
  async move(file: string, to: string): Promise<void>;
  async rename(file: string, name: string): Promise<void>;
  async delete(path: string, permanent?: boolean): Promise<void>;
  async templateRead(name: string, resolve?: boolean, title?: string): Promise<string>;
  async dailyRead(): Promise<string>;
  async dailyAppend(content: string): Promise<void>;
  async recents(): Promise<string[]>;
  async tabs(): Promise<TabInfo[]>;
  async eval(code: string): Promise<any>;
  async command(id: string): Promise<void>;
}
```

**Protocol detail:**

```typescript
async exec(argv: string[], params?: Record<string, string | boolean>): Promise<string> {
  const args = [...argv];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'boolean') {
        if (v) args.push(k);
      } else {
        args.push(`${k}=${v}`);
      }
    }
  }
  const payload = JSON.stringify({
    argv: args,
    tty: false,
    cwd: this.vaultCwd,
  }) + '\n';
  // connect to socket → write → read response → return
}
```

### Health check

```typescript
async ping(): Promise<boolean> {
  try {
    await this.exec(['version']);
    return true;
  } catch {
    return false;
  }
}
```

If Obsidian isn't running, user-visible vault operations fail with an explicit CLI-required error. Internal generated metadata can still use filesystem paths.

---

## 2. Integration: wiki_search → obsidian search:context + properties

### Replace

`wiki_search` currently loads `registry.json` and does substring matching on title, aliases, headings, summary, tags, and source IDs.

### With

```typescript
// extensions/brain-wiki/src/search.ts
async function searchRegistry(obsidian: ObsidianClient, query: string, options?: {
  type?: WikiPageType;
  limit?: number;
  includeArchived?: boolean;
}): Promise<SearchMatch[]> {
  const scope = options?.type
    ? `Wiki/pages/${options.type}s`
    : 'Wiki';
  
  // Full-text search via Obsidian
  const results = await obsidian.search(query, {
    path: scope,
    limit: options?.limit ?? 10,
    format: 'json',
  });
  
  // Enrich with properties for each match
  return Promise.all(results.map(async (path) => {
    const props = await obsidian.properties(path);
    return {
      path,
      title: props.title ?? basename(path, '.md'),
      aliases: props.aliases ?? [],
      tags: props.tags ?? [],
      status: props.status,
      sourceIds: props.source_ids ?? [],
      summary: props.summary,
    };
  }));
}
```

### Phase-out

| Step | Action |
|------|--------|
| 1 | Add `ObsidianClient` and require it for user-visible search |
| 2 | Delegate search to CLI and map hits through the current `registry.json` |
| 3 | Keep `registry.json` as generated internal metadata |
| 4 | Eventually remove `registry.json` entirely, or generate it only as a cache for offline |

---

## 3. Integration: cross-vault backlinks → obsidian backlinks

### Replace

The indexer currently builds `backlinks.json` by scanning all wiki pages for `[[wikilinks]]` — limited to the Wiki/ folder only.

### With

```typescript
// extensions/brain-wiki/src/indexer.ts (partial replacement)
async function getBacklinks(obsidian: ObsidianClient, file: string): Promise<BacklinkEntry[]> {
  const raw = await obsidian.backlinks(file, { counts: true, format: 'json' });
  return raw; // returns links from entire vault: Area/, Project/, Wiki/, etc.
}
```

### What this unlocks

- **Map agent** answers: *"What does the rest of your Brain say about lambda calculus?"*
- **Workshop agent** finds Area/ notes that mention the same concept — proposes linking or integration
- **Intelligence agent** computes a "vault relevance score": topics with 0 external backlinks are either brand new or irrelevant

### Properties on the `topics/*.md` pages

```yaml
# maintained automatically
external_backlinks: 12    # count of links from outside Wiki/
last_graph_sync: 2026-05-07
```

These are set via `obsidian property:set` so they render as Obsidian properties.

---

## 4. Integration: property-driven lifecycle → obsidian property:*

### Replace

Currently Pi parses frontmatter via `gray-matter` on every read/write. Lifecycle state (`status`, `source_ids`, `consumed_at`) lives in YAML frontmatter that only Pi reads.

### With

```typescript
// extensions/brain-wiki/src/properties.ts
async function setWikiStatus(
  obsidian: ObsidianClient,
  page: string,
  status: 'draft' | 'published' | 'consumed' | 'archived' | 'cleared'
): Promise<void> {
  await obsidian.propertySet(page, 'status', status, 'text');
}

async function addSourceId(
  obsidian: ObsidianClient,
  page: string,
  sourceId: string
): Promise<void> {
  await obsidian.propertySet(page, 'source_ids', sourceId, 'list');
}
```

### Benefits

- **Obsidian-native** — properties render as pills, filterable in the UI
- **Dataview-queryable** — `TABLE status FROM "Wiki"` works without any plugin config
- **Cross-tool** — any Obsidian plugin can read wiki state
- **Eliminates** — the custom frontmatter parsing in `frontmatter.ts`

### Migration

1. `property:set` writes to the same frontmatter fields that `gray-matter` reads — they're compatible
2. Transition read paths to use `obsidian property:read` first (faster, live)
3. Eventually remove `gray-matter` dependency from the extension

---

## 5. Integration: daily notes bridge → obsidian daily:*

### Current state

No connection between the wiki and daily notes. The Intelligence agent scans filesystem timestamps for activity.

### Pipeline

```
capture direction (Workshop agent):
  obsidian daily:read
    → scan for URLs, ideas, meeting notes
    → propose capture via wiki_capture_source
    → obsidian daily:append content="- ✅ Captured to Wiki: [topic](...)"

review direction (Intelligence agent):
  wiki_scan_activity
    → obsidian daily:append content="- Wiki review W19: 3 topics created, 5 sources integrated"
    → obsidian daily:prepend content="- 📋 Gaps detected in wiki: [topic], [topic]"

awareness direction (Map agent):
  "What were you working on yesterday?"
    → obsidian daily:read (yesterday's note)
    → cross-reference with wiki topics
```

### Commands

```typescript
async function getDailyContent(obsidian: ObsidianClient): Promise<string> {
  return obsidian.dailyRead();
}

async function appendToDaily(obsidian: ObsidianClient, content: string): Promise<void> {
  await obsidian.dailyAppend(content);
}

async function getDailyPath(obsidian: ObsidianClient): Promise<string> {
  return obsidian.exec(['daily:path']);
}

async function getDailyTasks(obsidian: ObsidianClient): Promise<Task[]> {
  const raw = await obsidian.exec(['tasks', 'daily', 'format=json']);
  return JSON.parse(raw);
}
```

### Agent skill updates

- **wiki-workshop SKILL.md** — add step: "Before proposing capture, scan `obsidian daily:read` for candidate URLs/ideas."
- **wiki-intel SKILL.md** — add step: "After analysis, push a summary to `obsidian daily:append`."
- **wiki-map SKILL.md** — add: "When asked about recent activity, check `obsidian daily:read` and `obsidian recents`."

---

## 6. Integration: file operations → obsidian create/move/rename/delete

### Replace

Currently the extension writes files via Pi's `write` tool (raw filesystem) and rebuilds metadata on every `agent_end`. Renames and moves are not handled — the wiki has no rename workflow.

### With

```typescript
// extensions/brain-wiki/src/obsidian-fs.ts
class ObsidianFS {
  constructor(private client: ObsidianClient) {}

  async writePage(path: string, content: string): Promise<void> {
    // Use create with overwrite flag
    await this.client.create(path, content);
  }

  async movePage(from: string, to: string): Promise<void> {
    // Obsidian auto-updates wikilinks if setting is on
    await this.client.move(from, to);
  }

  async renamePage(path: string, newName: string): Promise<void> {
    await this.client.rename(path, newName);
  }

  async deletePage(path: string): Promise<void> {
    await this.client.delete(path); // goes to trash
  }
}
```

### Guardrails

The existing `guards.ts` logic (protected paths, outside-wiki blocks) still applies — the `ObsidianFS` class is only used for paths within `Wiki/`. The guard runs *before* delegating to the CLI.

### What this enables

- **Move/rename wiki pages** without breaking links — `obsidian move` updates internal links automatically
- **Safe deletes** — files go to Obsidian trash, not permanently removed
- **Index sync** — Obsidian's internal index stays current; no need for manual `reload`
- **Recents** — files created via CLI appear in Obsidian's recent list

---

## 7. Integration: templates → obsidian template:read

### Replace

The extension currently has its own template files at `.wiki/templates/` and its own variable resolution in `frontmatter.ts`.

### With

```typescript
// extensions/brain-wiki/src/templates.ts
async function renderWikiTemplate(
  obsidian: ObsidianClient,
  templateName: string,
  variables: { title: string; aliases?: string[]; summary?: string }
): Promise<string> {
  return obsidian.templateRead(templateName, {
    resolve: true,
    title: variables.title,
  });
}
```

The user defines wiki templates as **Obsidian templates** in their vault's template folder. They use `{{title}}`, `{{date}}`, `{{aliases}}` syntax natively, can include Dataview queries, and are editable in Obsidian's GUI with full theme support.

Obsidian handles template variable resolution; Pi just reads the rendered result.

### Migration

1. Move `.wiki/templates/topic.md` → `Templates/wiki-topic.md` in the vault
2. Update `scaffold.ts` to call `obsidian template:read name=wiki-topic resolve title="..."` instead of its own rendering
3. Keep the custom templates as fallback when Obsidian CLI isn't available

---

## 8. Integration: lint → obsidian unresolved/orphans/deadends

### Replace

The lint module currently reimplements link checking (parsing `[[wikilinks]]` from every file), orphan detection (files with zero inbound links), and dead-end detection (files with zero outbound links).

### With

```typescript
// extensions/brain-wiki/src/lint.ts (additions)
async function getBrokenLinks(obsidian: ObsidianClient): Promise<LintIssue[]> {
  const raw = await obsidian.unresolved({ format: 'json', verbose: true });
  return raw.flatMap((entry: any) =>
    entry.sources.map((src: string) => ({
      kind: 'broken-link',
      severity: 'error' as const,
      path: src,
      message: `Unresolved link: ${entry.link}`,
    }))
  );
}

async function getOrphans(obsidian: ObsidianClient): Promise<LintIssue[]> {
  const raw = await obsidian.orphans({ total: true, all: true });
  // Filter to Wiki/ pages only
  return raw
    .filter((p: string) => p.startsWith('Wiki/'))
    .map((p: string) => ({
      kind: 'orphan',
      severity: 'warning' as const,
      path: p,
      message: 'No incoming links from any vault page',
    }));
}

async function getDeadends(obsidian: ObsidianClient): Promise<LintIssue[]> {
  const raw = await obsidian.deadends({ total: true, all: true });
  return raw
    .filter((p: string) => p.startsWith('Wiki/'))
    .map((p: string) => ({
      kind: 'deadend',
      severity: 'info' as const,
      path: p,
      message: 'No outgoing links',
    }));
}
```

### What this changes

- **Broader scope** — lint checks the full vault graph, not just Wiki/ internal links
- **No false positives** — Obsidian's parser is more accurate than Pi's regex for `[[wikilinks]]`
- **Faster** — Obsidian's graph is always live; no need to rescan files
- **Migration** — replace the custom `lint.ts` link/orphan/deadend logic; keep frontmatter, coverage, and staleness checks as-is (they operate on wiki-specific semantics, not graph structure)

---

## 9. Bonus: live awareness for Intelligence agent

### Commands

```typescript
// extensions/brain-wiki/src/activity.ts (extensions)
async function getRecentFiles(obsidian: ObsidianClient): Promise<string[]> {
  return obsidian.recents();
}

async function getOpenTabs(obsidian: ObsidianClient): Promise<TabInfo[]> {
  return obsidian.tabs({ ids: true });
}

async function getFileHistory(obsidian: ObsidianClient, path: string): Promise<DiffEntry[]> {
  return obsidian.diff({ file: path });
}
```

### Usage

- **Intelligence agent** replaces filesystem `stat` calls with `obsidian file path=X` for accurate timestamps
- **Map agent** checks `obsidian recents` to know what Walker was looking at before answering
- **Workshop agent** checks `obsidian tabs` to see if a wiki page is open and thus a high-priority target

---

## Migration plan

| Phase | Component | Change |
|-------|-----------|--------|
| **P0** | `obsidian-client.ts` | Build the client. Implement `exec()`, `ping()`, `search()`, `backlinks()`, `properties()`, `create()`, `read()` — the core read/write primitives. |
| **P1** | `wiki_search` | Delegate search to `obsidian search:context` when client is healthy. Fall back to current registry. |
| **P1** | `wiki_lint` | Add CLI-based lint modes for links/orphans/deadends alongside existing checks. |
| **P1** | Indexer | Use `obsidian backlinks` to enrich backlinks.json with cross-vault data. |
| **P2** | Scaffold | Use `obsidian create` instead of raw `write` for page creation. |
| **P2** | Templates | Move wiki templates to Obsidian Templates folder. Use `obsidian template:read` for rendering. |
| **P2** | Properties | Set wiki metadata via `obsidian property:set`. Add `obsidian property:read` as a faster frontmatter reader. |
| **P3** | Daily bridge | Add daily note read/append to Workshop and Intelligence agent workflows. |
| **P3** | Activity scanning | Use `obsidian file` timestamps and `obsidian recents` instead of filesystem stat. |
| **P3** | Rename/move | Add move/rename workflows to Workshop agent using `obsidian move`. |

### Rollback

User-visible CLI delegation checks `client.ping()` before execution. If Obsidian is not running, the operation fails before mutating vault-visible content.

---

## Scope table

| Layer | Item | Description |
|-------|------|-------------|
| New | extensions/brain-wiki/src/obsidian-client.ts | `ObsidianClient` class — Unix socket protocol, typed convenience methods, ping/health |
| New | extensions/brain-wiki/src/obsidian-io.ts | Markdown/property IO boundary — wraps create/read/append/prepend/property:set with path conversion |
| New | extensions/brain-wiki/src/properties.ts | Property helpers — `setWikiStatus()`, `addSourceId()`, `readProperties()` |
| Modified | extensions/brain-wiki/src/search.ts | Delegate to `obsidian search:context` with property enrichment; fallback to registry |
| Modified | extensions/brain-wiki/src/indexer.ts | Enrich backlinks with cross-vault data via `obsidian backlinks` |
| Modified | extensions/brain-wiki/src/lint.ts | Add CLI-sourced link/orphan/deadend checks alongside existing checks |
| Modified | extensions/brain-wiki/src/scaffold.ts | Use `obsidian create` and `obsidian template:read` when available |
| Modified | extensions/brain-wiki/src/activity.ts | Use `obsidian file`, `obsidian recents`, `obsidian daily:read` for live data |
| Modified | extensions/brain-wiki/index.ts | Initialize `ObsidianClient` on startup, pass to tool handlers |
| Skills | wiki-workshop SKILL.md | Add daily note scan step |
| Skills | wiki-intel SKILL.md | Add daily note push step |
| Skills | wiki-map SKILL.md | Add live awareness step |
