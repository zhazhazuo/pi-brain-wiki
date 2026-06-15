# Graph-First Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vault-wide graph discovery and enforce Obsidian CLI as the default boundary for vault-visible knowledge workflows while preserving the internal wiki registry for lifecycle and deterministic reports.

**Architecture:** The implementation adds a focused `graph.ts` layer on top of `ObsidianClient`, extends the public tool surface with vault-aware search and graph discovery tools, then integrates those capabilities into existing write paths. Internal generated metadata remains filesystem-backed; user-visible vault content moves further toward Obsidian-backed reads and writes.

**Tech Stack:** TypeScript, Node.js, `@sinclair/typebox`, existing `ObsidianClient`, existing test suite under `extensions/brain-wiki/src/*.test.ts`

---

### Task 1: Add failing tests for vault-wide search behavior

**Files:**
- Modify: `extensions/brain-wiki/src/search.test.ts`
- Modify: `extensions/brain-wiki/src/search.ts`
- Test: `extensions/brain-wiki/src/search.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("searchViaObsidian supports wiki scope through searchContext", async () => {
  const registry = {
    pages: [
      {
        id: "topic-1",
        type: "topic",
        path: "pages/topics/agent.md",
        title: "Agent",
        summary: "Agent topic",
        aliases: [],
        sourceIds: [],
        status: "integrated",
      },
    ],
  } as any;

  const client = {
    searchContext: async () => [{ file: "Wiki/pages/topics/agent.md" }],
    search: async () => {
      throw new Error("search should not be called for wiki scope");
    },
  } as any;

  const result = await searchViaObsidian(
    client,
    registry,
    "agent",
    "topic",
    10,
    [],
    "wiki",
  );

  expect(result.matches).toHaveLength(1);
  expect(result.matches[0].path).toBe("pages/topics/agent.md");
});

test("searchViaObsidian supports vault scope through search", async () => {
  const registry = {
    pages: [
      {
        id: "topic-1",
        type: "topic",
        path: "pages/topics/agent.md",
        title: "Agent",
        summary: "Agent topic",
        aliases: [],
        sourceIds: [],
        status: "integrated",
      },
    ],
  } as any;

  const client = {
    searchContext: async () => {
      throw new Error("searchContext should not be called for vault scope");
    },
    search: async () => ["Wiki/pages/topics/agent.md", "Area/1 CS/17 AI/Agent.md"],
    properties: async (path: string) => ({
      title: path.includes("Area/") ? "PKB Agent" : "Agent",
      tags: path.includes("Area/") ? ["RESOURCE"] : [],
      summary: path.includes("Area/") ? "PKB entry" : "Agent topic",
      aliases: [],
      status: "integrated",
      source_ids: [],
    }),
  } as any;

  const result = await searchViaObsidian(
    client,
    registry,
    "agent",
    undefined,
    10,
    [],
    "vault",
  );

  expect(result.matches.map((m) => m.title)).toEqual(["Agent", "PKB Agent"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/search.test.ts`
Expected: FAIL with argument mismatch or missing `scope` support in `searchViaObsidian`

- [ ] **Step 3: Write minimal implementation**

```ts
export async function searchViaObsidian(
  client: ObsidianClient,
  registry: RegistryData,
  query: string,
  type?: WikiPageType,
  limit?: number,
  excludeStatuses?: string[],
  scope: "wiki" | "vault" = "wiki",
): Promise<SearchResult> {
  if (scope === "vault") {
    const rawHits = await client.search(query, { format: "text", limit: limit ?? 10 });
    return mapVaultHits(client, registry, rawHits, excludeStatuses);
  }

  const wikiHits = await client.searchContext(query, { path: type ? `Wiki/${TYPE_DIR[type]}` : "Wiki", limit: limit ?? 10 });
  return mapWikiHits(registry, wikiHits, excludeStatuses);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/search.ts extensions/brain-wiki/src/search.test.ts
git commit -m "feat: add vault-aware wiki search support"
```

### Task 2: Extend the public `wiki_search` tool with a `scope` parameter

**Files:**
- Modify: `extensions/brain-wiki/index.ts`
- Modify: `extensions/brain-wiki/src/search.ts`
- Test: `extensions/brain-wiki/src/search.test.ts`

- [ ] **Step 1: Write the failing test coverage for the new parameter contract**

```ts
test("resolveSearchScope defaults to wiki", () => {
  expect(resolveSearchScope(undefined)).toBe("wiki");
});

test("resolveSearchScope preserves explicit vault scope", () => {
  expect(resolveSearchScope("vault")).toBe("vault");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/search.test.ts`
Expected: FAIL with missing `resolveSearchScope` export

- [ ] **Step 3: Write minimal implementation**

```ts
export function resolveSearchScope(scope?: "wiki" | "vault"): "wiki" | "vault" {
  return scope ?? "wiki";
}
```

```ts
parameters: Type.Object({
  query: Type.String({ description: "Search query" }),
  scope: Type.Optional(StringEnum(["wiki", "vault"] as const)),
  type: Type.Optional(PAGE_TYPE_ENUM),
  limit: Type.Optional(Type.Number({ description: "Maximum number of matches to return" })),
  includeArchived: Type.Optional(Type.Boolean({ description: "Include archived and cleared entries in results (default: false)" })),
})

const result = await searchViaObsidian(
  client,
  registry,
  params.query,
  params.type as WikiPageType | undefined,
  params.limit,
  excludeStatuses,
  resolveSearchScope(params.scope),
);
```

- [ ] **Step 4: Run test and typecheck**

Run: `bun test extensions/brain-wiki/src/search.test.ts`
Expected: PASS

Run: `npx -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/index.ts extensions/brain-wiki/src/search.ts extensions/brain-wiki/src/search.test.ts
git commit -m "feat: expose vault scope in wiki search tool"
```

### Task 3: Add `links()` and `outline()` to `ObsidianClient`

**Files:**
- Modify: `extensions/brain-wiki/src/obsidian-client.ts`
- Modify: `extensions/brain-wiki/src/obsidian-client.test.ts`
- Test: `extensions/brain-wiki/src/obsidian-client.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("links parses Obsidian line output", async () => {
  const { client, socket } = createHarness();
  socket.enqueue("Wiki/pages/topics/foo.md\nArea/1 CS/Agent.md\n");
  await expect(client.links("Wiki/pages/topics/agent.md")).resolves.toEqual([
    "Wiki/pages/topics/foo.md",
    "Area/1 CS/Agent.md",
  ]);
});

test("outline parses Obsidian JSON output", async () => {
  const { client, socket } = createHarness();
  socket.enqueue('[{"level":1,"text":"What"},{"level":2,"text":"Idea"}]');
  await expect(client.outline("Area/1 CS/Agent.md")).resolves.toEqual([
    { level: 1, text: "What" },
    { level: 2, text: "Idea" },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/obsidian-client.test.ts`
Expected: FAIL with missing `links` and `outline` methods

- [ ] **Step 3: Write minimal implementation**

```ts
async links(file: string): Promise<string[]> {
  const raw = await this.exec(["links"], { path: file });
  return parseLineList(raw, `Obsidian links failed for ${file}`);
}

async outline(file: string): Promise<Array<{ level: number; text: string }>> {
  const raw = await this.exec(["outline"], { path: file, format: "json" });
  return parseJsonArray(raw, `Obsidian outline failed for ${file}`).map((entry: any) => ({
    level: Number(entry.level),
    text: String(entry.text),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/obsidian-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/obsidian-client.ts extensions/brain-wiki/src/obsidian-client.test.ts
git commit -m "feat: add outgoing link and outline cli helpers"
```

### Task 4: Add a shared graph discovery module

**Files:**
- Create: `extensions/brain-wiki/src/graph.ts`
- Create: `extensions/brain-wiki/src/graph.test.ts`
- Modify: `extensions/brain-wiki/src/types.ts`
- Test: `extensions/brain-wiki/src/graph.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("findGraphContext groups wiki and pkb hits", async () => {
  const client = {
    search: async () => ["Wiki/pages/topics/agent.md", "Area/1 CS/17 AI/Agent.md"],
    properties: async (path: string) => ({
      title: path.includes("Wiki/") ? "Agent Topic" : "Agent PKB",
      tags: path.includes("Wiki/") ? [] : ["RESOURCE"],
      summary: "summary",
      aliases: [],
      status: "integrated",
      source_ids: [],
    }),
    backlinks: async () => [{ file: "Project/Foo.md", count: 2 }],
  } as any;

  const result = await findGraphContext(client, ["agent"]);
  expect(result.wiki).toHaveLength(1);
  expect(result.pkb).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: FAIL because `graph.ts` does not exist

- [ ] **Step 3: Write minimal implementation**

```ts
export async function findGraphContext(
  client: ObsidianClient,
  terms: string[],
): Promise<GraphContextResult> {
  const hits = await client.search(terms.join(" "), { limit: 12, format: "text" });
  const nodes = await Promise.all(hits.map(async (path: string) => {
    const properties = await client.properties(path);
    const backlinks = await client.backlinks(path);
    return {
      path,
      zone: path.startsWith("Wiki/") ? "wiki" : "pkb",
      title: String(properties.title ?? path),
      tags: Array.isArray(properties.tags) ? properties.tags : [],
      summary: typeof properties.summary === "string" ? properties.summary : undefined,
      backlinks,
    };
  }));

  return {
    query: terms.join(" "),
    wiki: nodes.filter((n) => n.zone === "wiki"),
    pkb: nodes.filter((n) => n.zone === "pkb"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/graph.ts extensions/brain-wiki/src/graph.test.ts extensions/brain-wiki/src/types.ts
git commit -m "feat: add shared graph discovery module"
```

### Task 5: Add the `wiki_graph_find` public tool

**Files:**
- Modify: `extensions/brain-wiki/index.ts`
- Modify: `extensions/brain-wiki/src/types.ts`
- Test: `extensions/brain-wiki/src/graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("formatGraphFind renders grouped graph results", () => {
  const text = formatGraphFind({
    query: "agent",
    wiki: [{ path: "Wiki/pages/topics/agent.md", title: "Agent Topic" }],
    pkb: [{ path: "Area/1 CS/17 AI/Agent.md", title: "Agent PKB" }],
  } as any);

  expect(text).toContain("Found in Wiki");
  expect(text).toContain("Found in PKB");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: FAIL because formatting/helper/tool code is missing

- [ ] **Step 3: Write minimal implementation**

```ts
pi.registerTool({
  name: "wiki_graph_find",
  label: "Wiki Graph Find",
  description: "Discover related wiki and PKB nodes across the vault before writing or revising knowledge.",
  parameters: Type.Object({
    query: Type.Optional(Type.String()),
    terms: Type.Optional(Type.Array(Type.String())),
    limit: Type.Optional(Type.Number()),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const root = await resolveWikiRoot(ctx.cwd);
    const client = await requireObsidianClient(root);
    const terms = params.terms?.length ? params.terms : [params.query ?? ""];
    const result = await findGraphContext(client, terms.filter(Boolean));
    return {
      content: [{ type: "text", text: formatGraphFind(result) }],
      details: result,
    };
  },
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: PASS

Run: `npx -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/index.ts extensions/brain-wiki/src/types.ts extensions/brain-wiki/src/graph.test.ts
git commit -m "feat: add graph find tool"
```

### Task 6: Add `wiki_graph_traverse` and `wiki_graph_bridge`

**Files:**
- Modify: `extensions/brain-wiki/index.ts`
- Modify: `extensions/brain-wiki/src/graph.ts`
- Modify: `extensions/brain-wiki/src/graph.test.ts`
- Test: `extensions/brain-wiki/src/graph.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("traverseNeighborhood returns first-hop backlinks and links", async () => {
  const client = {
    backlinks: async () => [{ file: "Project/Foo.md", count: 2 }],
    links: async () => ["Area/1 CS/Bar.md"],
    properties: async () => ({ title: "Agent" }),
  } as any;

  const result = await traverseNeighborhood(client, "Area/1 CS/Agent.md", 1);
  expect(result.backlinks).toHaveLength(1);
  expect(result.links).toEqual(["Area/1 CS/Bar.md"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: FAIL because neighborhood and bridge functions are missing

- [ ] **Step 3: Write minimal implementation**

```ts
export async function traverseNeighborhood(
  client: ObsidianClient,
  path: string,
  hops = 1,
): Promise<GraphNeighborhood> {
  const backlinks = await client.backlinks(path);
  const links = await client.links(path);
  return { path, hops, backlinks, links };
}

export async function bridgeWikiPage(
  client: ObsidianClient,
  pagePath: string,
): Promise<GraphBridgeResult> {
  const content = await client.readFile(pagePath);
  const terms = content.split(/\W+/).filter(Boolean).slice(0, 12);
  const context = await findGraphContext(client, terms);
  return { pagePath, candidates: context.pkb.slice(0, 5) };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: PASS

Run: `npx -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/index.ts extensions/brain-wiki/src/graph.ts extensions/brain-wiki/src/graph.test.ts
git commit -m "feat: add graph traverse and bridge tools"
```

### Task 7: Integrate graph discovery into `wiki_capture_source`

**Files:**
- Modify: `extensions/brain-wiki/src/capture.ts`
- Modify: `extensions/brain-wiki/index.ts`
- Modify: `extensions/brain-wiki/src/graph.ts`
- Test: `extensions/brain-wiki/src/graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("capture flow can append PKB context block from graph results", () => {
  const block = renderPkbContextBlock([
    { path: "Area/1 CS/17 AI/Agent.md", title: "Agent PKB" },
  ] as any);

  expect(block).toContain("## PKB Context");
  expect(block).toContain("[[Area/1 CS/17 AI/Agent.md|Agent PKB]]");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: FAIL because the helper does not exist

- [ ] **Step 3: Write minimal implementation**

```ts
export function renderPkbContextBlock(nodes: Array<{ path: string; title: string }>): string {
  if (nodes.length === 0) return "";
  return [
    "## PKB Context",
    "",
    ...nodes.map((node) => `- [[${node.path.replace(/\\.md$/, "")}|${node.title}]]`),
    "",
  ].join("\n");
}
```

```ts
const graphContext = await findGraphContext(client, extractedTerms);
const pkbBlock = renderPkbContextBlock(graphContext.pkb.slice(0, 5));
const bodyWithContext = pkbBlock ? `${pkbBlock}\n${body}` : body;
```

- [ ] **Step 4: Run targeted tests**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/capture.ts extensions/brain-wiki/index.ts extensions/brain-wiki/src/graph.ts extensions/brain-wiki/src/graph.test.ts
git commit -m "feat: add graph context to captured source pages"
```

### Task 8: Integrate graph discovery into `wiki_ensure_page`

**Files:**
- Modify: `extensions/brain-wiki/src/scaffold.ts`
- Modify: `extensions/brain-wiki/index.ts`
- Modify: `extensions/brain-wiki/src/graph.ts`
- Test: `extensions/brain-wiki/src/graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("buildEnsurePageGraphTerms uses title and summary", () => {
  expect(buildEnsurePageGraphTerms("Agent Systems", "PKB-aligned summary")).toEqual([
    "Agent Systems",
    "PKB-aligned summary",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: FAIL with missing `buildEnsurePageGraphTerms`

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildEnsurePageGraphTerms(title: string, summary?: string): string[] {
  return [title, summary].filter(Boolean) as string[];
}
```

```ts
const graphContext = await findGraphContext(client, buildEnsurePageGraphTerms(params.title, params.summary));
const bodyPrefix = renderPkbContextBlock(graphContext.pkb.slice(0, 5));
const body = bodyPrefix ? `${bodyPrefix}\n${templateBody}` : templateBody;
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: PASS

Run: `npx -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/scaffold.ts extensions/brain-wiki/index.ts extensions/brain-wiki/src/graph.ts
git commit -m "feat: seed ensured pages with pkb context"
```

### Task 9: Add `graph` mode to `wiki_lint`

**Files:**
- Modify: `extensions/brain-wiki/src/lint.ts`
- Modify: `extensions/brain-wiki/index.ts`
- Modify: `extensions/brain-wiki/src/lint.test.ts`
- Test: `extensions/brain-wiki/src/lint.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("graph lint mode uses cli graph checks", async () => {
  const client = {
    unresolved: async () => [],
    orphans: async () => [],
    deadends: async () => [],
    backlinks: async () => [],
  } as any;

  const result = await runLint("/tmp/wiki", "graph", false, undefined, client);
  expect(result.mode).toBe("graph");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/lint.test.ts`
Expected: FAIL because `graph` is not a supported mode

- [ ] **Step 3: Write minimal implementation**

```ts
if (mode === "graph" || mode === "all") {
  if (!client) {
    throw new Error("graph lint mode requires Obsidian CLI");
  }
  allIssues.push(...await lintGraphConnectivity(root, registry, client));
}
```

```ts
const LINT_MODE_ENUM = StringEnum([
  "links",
  "orphans",
  "frontmatter",
  "duplicates",
  "coverage",
  "staleness",
  "graph",
  "all",
] as const);
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test extensions/brain-wiki/src/lint.test.ts`
Expected: PASS

Run: `npx -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/lint.ts extensions/brain-wiki/index.ts extensions/brain-wiki/src/lint.test.ts
git commit -m "feat: add graph connectivity lint mode"
```

### Task 10: Remove remaining direct filesystem fallbacks for vault-visible LIST workflows

**Files:**
- Modify: `extensions/brain-wiki/src/task-sync.ts`
- Modify: `extensions/brain-wiki/src/triage.ts`
- Modify: `extensions/brain-wiki/src/project-sync.ts`
- Modify: `extensions/brain-wiki/src/task-sync.test.ts`
- Test: `extensions/brain-wiki/src/task-sync.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("markListItemPromoted requires Obsidian-backed markdown path when client is provided", async () => {
  const client = {
    readFile: async () => "**2026-06-15**\n- [ ] test\n",
    create: async () => undefined,
  } as any;

  await expect(markListItemPromoted("/tmp/wiki", "2026-06-15", 1, client)).resolves.toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/task-sync.test.ts`
Expected: FAIL if tests do not yet cover the Obsidian-backed path explicitly

- [ ] **Step 3: Write minimal implementation**

```ts
if (!client) {
  throw new Error("vault-visible LIST.md mutations require ObsidianClient");
}

const content = await readMarkdown(client, listPath);
await writeMarkdown(client, listPath, newContent);
```

- [ ] **Step 4: Run tests and targeted regression checks**

Run: `bun test extensions/brain-wiki/src/task-sync.test.ts`
Expected: PASS

Run: `bun test extensions/brain-wiki/src/task-scan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/task-sync.ts extensions/brain-wiki/src/triage.ts extensions/brain-wiki/src/project-sync.ts extensions/brain-wiki/src/task-sync.test.ts
git commit -m "refactor: require obsidian client for vault-visible list workflows"
```

### Task 11: Final verification and documentation sweep

**Files:**
- Modify: `docs/04_modules/obsidian-cli.md`
- Modify: `docs/04_modules/obsidian-io.md`
- Modify: `docs/04_modules/indexer.md`
- Modify: `docs/04_modules/lint.md`
- Modify: `docs/04_modules/task-sync.md`

- [ ] **Step 1: Update docs to match the implemented architecture**

```md
- `wiki_search` supports `scope="vault"` using Obsidian CLI `search()`
- graph discovery flows through `src/graph.ts`
- vault-visible LIST workflows require Obsidian-backed paths
- registry remains an internal wiki lifecycle artifact, not the vault graph source of truth
```

- [ ] **Step 2: Run full targeted verification**

Run: `bun test extensions/brain-wiki/src/obsidian-client.test.ts`
Expected: PASS

Run: `bun test extensions/brain-wiki/src/search.test.ts`
Expected: PASS

Run: `bun test extensions/brain-wiki/src/graph.test.ts`
Expected: PASS

Run: `bun test extensions/brain-wiki/src/lint.test.ts`
Expected: PASS

Run: `bun test extensions/brain-wiki/src/task-sync.test.ts`
Expected: PASS

Run: `npx -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/04_modules/obsidian-cli.md docs/04_modules/obsidian-io.md docs/04_modules/indexer.md docs/04_modules/lint.md docs/04_modules/task-sync.md
git commit -m "docs: align knowledge base with graph-first architecture"
```

---

## Self-Review

- Spec coverage: this plan covers vault-wide search, new graph tooling, connect-before-write integration, graph lint, and IO-boundary tightening.
- Placeholder scan: placeholder phrasing removed from task steps; each task now has a concrete test seam or verification command.
- Type consistency: all tasks assume the shared graph API lives in `extensions/brain-wiki/src/graph.ts` and that public tool wiring remains in `extensions/brain-wiki/index.ts`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-graph-first-architecture-upgrade.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
