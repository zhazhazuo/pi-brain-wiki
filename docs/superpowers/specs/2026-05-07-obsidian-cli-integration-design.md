# Obsidian CLI Integration — Scoped Design

> Scope: Cross-vault backlinks + search delegation via Obsidian CLI.
> Status: **approved** — ready for implementation planning.

## Goal

Enrich the brain-wiki extension with two high-value capabilities from the Obsidian CLI:

1. **Cross-vault backlinks** — know which Area/, Project/, and Resource/ notes link to wiki topics
2. **Search delegation** — use Obsidian's full-text search with context when available, fall back to current registry

Everything else (properties, templates, daily notes, file ops, rename) is out of scope for this iteration.

## What We Get

| Capability | Before | After |
|---|---|---|
| Backlinks | Wiki-internal links only (~40 pages) | Cross-vault graph (4404 files → Wiki/) |
| Search | Substring match on registry fields | Obsidian full-text search with context lines |
| Offline | Works everywhere | Falls back to current behavior when Obsidian is not running |

---

## Section 1: ObsidianClient

**File:** `extensions/brain-wiki/src/obsidian-client.ts` (~120 lines)

A thin protocol wrapper that speaks the Obsidian CLI protocol over the Unix socket at `~/.obsidian-cli.sock`.

### Interface

```typescript
interface ObsidianClientConfig {
  socketPath: string;    // default: ~/.obsidian-cli.sock
  vaultCwd: string;      // vault root: /Users/walkerw/Research/Brain
  timeout: number;       // ms, default 10000
}

interface BacklinkResult {
  file: string;
  count: number;
}

interface SearchHit {
  file: string;
  matches: Array<{ line: number; text: string }>;
}

class ObsidianClient {
  constructor(config: ObsidianClientConfig);

  async exec(argv: string[], params?: Record<string, string | boolean>): Promise<string>;
  async ping(): Promise<boolean>;
  async backlinks(file: string): Promise<BacklinkResult[]>;
  async searchContext(query: string, opts?: { path?: string; limit?: number }): Promise<SearchHit[]>;
}
```

### Protocol

```typescript
async exec(argv: string[], params?: Record<string, string | boolean>): Promise<string> {
  const args = [...argv];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'boolean') {
        if (v) args.push(k);  // bare word, no prefix
      } else {
        args.push(`${k}=${v}`);
      }
    }
  }
  const payload = JSON.stringify({
    argv: args,
    tty: false,
    cwd: this.config.vaultCwd,
  }) + '\n';
  // connect to socket → write payload → read response → return
}
```

### Lifecycle

- Created once in `index.ts` at extension init via `getObsidianClient(root)`
- `ping()` called before first use; if it fails, client is discarded and all callers fall back
- No retry logic, no reconnect — simple pass/fail per session
- Socket path resolved from `~/.obsidian-cli.sock` (macOS/Linux) or configurable

---

## Section 2: Registry Enrichment (Cross-Vault Backlinks)

**File:** `extensions/brain-wiki/src/indexer.ts` (add ~20 lines)

### When It Runs

Inside `rebuildRegistryAndIndex()`, after building the registry from file scans. Only runs when Obsidian is available.

### What Gets Added

```typescript
// In types.ts — add to RegistryPage
interface RegistryPage {
  // ... existing fields ...
  external_backlinks: number;        // count of links from outside Wiki/
  external_sources: string[];        // top 5 source files
}
```

### Enrichment Logic

```typescript
async function enrichWithBacklinks(
  client: ObsidianClient,
  pages: RegistryPage[],
): Promise<void> {
  for (const page of pages) {
    const backlinks = await client.backlinks(`Wiki/${page.path}`);
    const external = backlinks.filter(b => !b.file.startsWith('Wiki/'));
    page.external_backlinks = external.length;
    page.external_sources = external
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(b => b.file);
  }
}
```

### Fallback

If `client.ping()` fails, skip enrichment. Registry pages get `external_backlinks: 0` and `external_sources: []`. No errors, no blocking.

### Performance

One `backlinks` CLI call per wiki page (~40 pages). Each is a single socket roundtrip. Total: ~40 sequential calls during rebuild. Runs only on `agent_end` when dirty.

---

## Section 3: Search Delegation

**File:** `extensions/brain-wiki/src/search.ts` (add ~40 lines)

### New Function

```typescript
export async function searchViaObsidian(
  client: ObsidianClient,
  registry: RegistryData,
  query: string,
  type?: WikiPageType,
  limit?: number,
  excludeStatuses?: string[],
): Promise<SearchResult> {
  const scope = type ? `Wiki/pages/${type}s` : 'Wiki';
  const hits = await client.searchContext(query, { path: scope, limit: limit ?? 10 });

  // Deduplicate by file (Obsidian returns multiple match lines per file)
  // Look up each file in registry for metadata (aliases, tags, sourceIds, summary, status)
  // Filter by excludeStatuses
  // Return SearchResult with same shape as searchRegistry()
}
```

### Integration Point

```typescript
// In index.ts wiki_search execute()
const client = await getObsidianClient(root);
if (client) {
  result = await searchViaObsidian(client, registry, params.query, params.type, params.limit, excludeStatuses);
} else {
  result = await searchRegistry(root, registry, params.query, params.type, params.limit, excludeStatuses);
}
```

### Result Format

Identical to current `SearchResult` — `query` + `matches[]` with `id`, `type`, `path`, `title`, `summary`, `aliases`, `score`, `sourceIds`. Agent code doesn't change.

### Scoring

Obsidian results are already ranked by relevance. We preserve Obsidian's ordering but still assign numeric scores for display consistency:
- First result: 100, second: 90, etc. (or reuse Obsidian's score if available)

---

## Section 4: Wiring (index.ts)

**File:** `extensions/brain-wiki/index.ts` (add ~25 lines)

### Client Initialization

```typescript
let cachedClient: ObsidianClient | null = null;

async function getObsidianClient(root: string): Promise<ObsidianClient | null> {
  if (cachedClient) return cachedClient;
  const client = new ObsidianClient({
    socketPath: join(homedir(), '.obsidian-cli.sock'),
    vaultCwd: resolve(root, '..'), // Wiki/ is inside the vault
    timeout: 10000,
  });
  if (await client.ping()) {
    cachedClient = client;
    return client;
  }
  return null;
}
```

### Changes to rebuildAllGeneratedArtifacts

```typescript
async function rebuildAllGeneratedArtifacts(root: string): Promise<string[]> {
  const config = await loadConfig(root);
  const client = await getObsidianClient(root);
  const { rebuilt } = await rebuildRegistryAndIndex(root, client);
  const logPath = await rebuildLog(root, config.title);
  return [...rebuilt, logPath];
}
```

### Changes to wiki_search tool

```typescript
const client = await getObsidianClient(root);
const registry = await loadRegistry(root);
const excludeStatuses = params.includeArchived ? [] : ["archived", "cleared"];
let result;
if (client) {
  result = await searchViaObsidian(client, registry, params.query, params.type, params.limit, excludeStatuses);
} else {
  result = await searchRegistry(root, registry, params.query, params.type, params.limit, excludeStatuses);
}
```

### Status Output

Add external backlinks to `formatStatus()`:

```
Wiki has 12 cross-vault backlinks across 8 pages (top: Lambda Calculus — 4 external)
```

---

## Type Changes

**File:** `extensions/brain-wiki/src/types.ts` (add ~15 lines)

```typescript
// Add to RegistryPage
external_backlinks: number;
external_sources: string[];

// New types
interface BacklinkResult {
  file: string;
  count: number;
}

interface SearchHit {
  file: string;
  matches: Array<{ line: number; text: string }>;
}

interface ObsidianClientConfig {
  socketPath: string;
  vaultCwd: string;
  timeout: number;
}
```

---

## File Summary

| File | Action | Lines |
|---|---|---|
| `src/obsidian-client.ts` | **New** | ~120 |
| `src/search.ts` | Add `searchViaObsidian()` | ~40 new |
| `src/indexer.ts` | Add `enrichWithBacklinks()` call | ~20 new |
| `src/types.ts` | Add fields + types | ~15 new |
| `index.ts` | Wire client init + search/rebuild | ~25 new |

**Total: ~220 lines new code. Zero breaking changes. Full fallback when Obsidian is offline.**

---

## What's NOT Changing

These files are untouched:
- `scaffold.ts`, `capture.ts`, `lint.ts`, `activity.ts`
- `guards.ts`, `frontmatter.ts`, `log.ts`, `paths.ts`, `config.ts`, `slug.ts`
- All skill files (SKILL.md)
- All tool registrations except `wiki_search` (handler only)

---

## Rollback

If Obsidian CLI causes issues:
1. `getObsidianClient()` returns `null` → all paths fall back to current behavior
2. No data written to Obsidian — all operations are read-only
3. Registry fields default to `external_backlinks: 0` / `external_sources: []`
4. Delete `obsidian-client.ts` and revert the 4 file changes → back to current state
