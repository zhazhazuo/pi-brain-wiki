import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeDefaultConfig } from "./config.ts";
import { buildRegistry, collectEdges, parseEdges, renderEdgesMarkdown, scanWikiPages } from "./indexer.ts";
import { integrateCapturedSource } from "./integration.ts";
import { runLint } from "./lint.ts";

const cleanupRoots: string[] = [];

afterAll(async () => {
  await Promise.all(
    cleanupRoots.map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function makeWikiRoot() {
  const root = await mkdtemp(join(tmpdir(), "brain-wiki-edges-"));
  cleanupRoots.push(root);
  await mkdir(join(root, "pages", "summaries"), { recursive: true });
  await mkdir(join(root, "pages", "topics"), { recursive: true });
  await mkdir(join(root, "meta"), { recursive: true });
  await writeDefaultConfig(root, "Test Wiki");
  return root;
}

async function writePage(root: string, relativePath: string, text: string) {
  const absolute = join(root, relativePath);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, text, "utf8");
}

function summaryPage(overrides: { frontmatter?: string; body?: string } = {}) {
  const frontmatter = overrides.frontmatter ?? `id: SRC-1
type: summary
title: Source A
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/a
manifest_path: inbox/SRC-1/manifest.json
raw_path: inbox/SRC-1/raw.md
source_ids:
  - SRC-1
summary: concise
edges:
  - id: edge-1
    text: How does X reconcile with Y?
    state: open
    created: 2026-06-14`;
  const body = overrides.body ?? `# Source A

## Bridge

**What you already know:** [[Area/1 CS/note]]
**What is genuinely new:** X
**Where the edge is:** X vs Y

## Integration targets
- [[topics/topic-a]] — adds context
`;
  return `---\n${frontmatter}\n---\n\n${body}`;
}

describe("parseEdges", () => {
  test("parses well-formed edges with defaults", () => {
    const edges = parseEdges([
      { text: "  What is the boundary?  " },
      { id: "e-2", text: "Second", state: "exploring", targets: ["topics/a"], created: "2026-06-01" },
    ]);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ id: "edge-1", text: "What is the boundary?", state: "open" });
    expect(edges[1]).toMatchObject({ id: "e-2", state: "exploring", targets: ["topics/a"] });
  });

  test("drops non-object entries and entries without text", () => {
    expect(parseEdges([null, "nope", { id: "x" }, { text: "" }])).toEqual([]);
    expect(parseEdges(undefined)).toEqual([]);
    expect(parseEdges("not-a-list")).toEqual([]);
  });
});

describe("collectEdges + renderEdgesMarkdown", () => {
  test("collects edges from registry pages with counts and ages", async () => {
    const root = await makeWikiRoot();
    await writePage(root, "pages/summaries/source-a.md", summaryPage());
    const pages = await scanWikiPages(root);
    const registry = buildRegistry(pages);
    const data = collectEdges(registry, new Date("2026-06-24").getTime());

    expect(data.counts).toEqual({ total: 1, open: 1, exploring: 0, resolved: 0 });
    expect(data.edges[0]).toMatchObject({
      pagePath: "pages/summaries/source-a.md",
      edgeId: "edge-1",
      state: "open",
      daysSinceCreated: 10,
    });

    const markdown = renderEdgesMarkdown(data);
    expect(markdown).toContain("# Edges — Learning Frontier");
    expect(markdown).toContain("## Open edges");
    expect(markdown).toContain("How does X reconcile with Y?");
    expect(markdown).toContain("(10d)");
  });
});

describe("runLint edges mode", () => {
  test("warns when an integrated summary has no edges frontmatter", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-a.md",
      summaryPage({
        frontmatter: `id: SRC-1
type: summary
title: Source A
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/a
manifest_path: inbox/SRC-1/manifest.json
raw_path: inbox/SRC-1/raw.md
source_ids:
  - SRC-1
summary: concise`,
      })
    );
    const run = await runLint(root, "edges");
    expect(run.issues.some((i) => i.kind === "edges" && i.severity === "warning" && i.message.includes("no `edges:`"))).toBe(true);
    expect(run.counts.edges).toBeGreaterThan(0);
  });

  test("flags invalid edge state and resolved edge without resolved_at", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-a.md",
      summaryPage({
        frontmatter: `id: SRC-1
type: summary
title: Source A
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/a
manifest_path: inbox/SRC-1/manifest.json
raw_path: inbox/SRC-1/raw.md
source_ids:
  - SRC-1
summary: concise
edges:
  - id: edge-1
    text: Bad state
    state: done
  - id: edge-2
    text: Resolved without date
    state: resolved`,
      })
    );
    const run = await runLint(root, "edges");
    expect(run.issues.some((i) => i.severity === "error" && i.message.includes("invalid state"))).toBe(true);
    expect(run.issues.some((i) => i.severity === "info" && i.message.includes("resolved_at"))).toBe(true);
  });

  test("flags missing Bridge section on integrated summaries as info", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-a.md",
      summaryPage({
        body: `# Source A

## Integration targets
- [[topics/topic-a]] — adds context
`,
      })
    );
    const run = await runLint(root, "edges");
    expect(run.issues.some((i) => i.severity === "info" && i.message.includes("## Bridge"))).toBe(true);
  });

  test("accepts a fully equipped summary page", async () => {
    const root = await makeWikiRoot();
    await writePage(root, "pages/summaries/source-a.md", summaryPage());
    const run = await runLint(root, "edges");
    expect(run.issues).toEqual([]);
  });
});

describe("integrateCapturedSource learning artifacts", () => {
  async function seedCapture(root: string) {
    await mkdir(join(root, "inbox", "SRC-1"), { recursive: true });
    await writeFile(
      join(root, "inbox", "SRC-1", "capture.state.json"),
      JSON.stringify({
        version: 1,
        sourceId: "SRC-1",
        status: "integration_pending",
        origin: { type: "url", value: "https://example.com/a" },
        capturedAt: "2026-06-14T00:00:00.000Z",
      }),
      "utf8"
    );
  }

  test("blocks integration when the summary page lacks learning artifacts", async () => {
    const root = await makeWikiRoot();
    await seedCapture(root);
    await writePage(
      root,
      "pages/summaries/src-1.md",
      `---
id: SRC-1
type: summary
title: Source A
status: captured
source_ids:
  - SRC-1
---

# Source A

## Integration targets
- [[topics/...]] — placeholder
`
    );

    await expect(
      integrateCapturedSource(root, "SRC-1", { pagePaths: ["pages/topics/topic-a.md"] })
    ).rejects.toThrow(/not ready to integrate/);
  });

  test("integrates when Bridge, edges, and concrete targets are present", async () => {
    const root = await makeWikiRoot();
    await seedCapture(root);
    await writePage(root, "pages/summaries/src-1.md", summaryPage());
    await writePage(
      root,
      "pages/topics/topic-a.md",
      `---
id: topic-a
type: topic
title: Topic A
status: draft
updated: 2026-06-14
source_ids: []
summary: t
---

# Topic A
`
    );

    const result = await integrateCapturedSource(root, "SRC-1", {
      pagePaths: ["pages/topics/topic-a.md"],
    });
    expect(result.sourceId).toBe("SRC-1");
    expect(result.integratedAt).toBeTruthy();
  });
});
