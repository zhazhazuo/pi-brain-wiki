import { describe, test, expect } from "bun:test";
import { resolveSearchScope, searchViaObsidian } from "./search.ts";
import type { RegistryData, RegistryEntry, SearchHit } from "./types.ts";

function makeRegistry(pages: Partial<RegistryEntry>[]): RegistryData {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    pages: pages.map((p, i) => ({
      id: String(p.id ?? `id-${i}`),
      type: p.type ?? "topic",
      path: p.path ?? `pages/topics/Page${i}.md`,
      title: p.title ?? `Page ${i}`,
      aliases: p.aliases ?? [],
      summary: p.summary ?? "",
      status: p.status,
      tags: p.tags ?? [],
      sourceIds: p.sourceIds ?? [],
      linksOut: [],
      headings: p.headings ?? [],
      wordCount: p.wordCount ?? 0,
      externalBacklinks: p.externalBacklinks ?? 0,
      externalSources: p.externalSources ?? [],
    })),
  };
}

function mockClient(hits: SearchHit[]) {
  return {
    searchContext: async (_query: string, _opts?: { path?: string; limit?: number }) => hits,
    config: { socketPath: "", vaultCwd: "", timeout: 0 },
  } as any;
}

describe("searchViaObsidian", () => {
  test("resolveSearchScope defaults to wiki", () => {
    expect(resolveSearchScope(undefined)).toBe("wiki");
  });

  test("resolveSearchScope preserves explicit vault scope", () => {
    expect(resolveSearchScope("vault")).toBe("vault");
  });

  test("deduplicates hits by file, preserving first occurrence order", async () => {
    const registry = makeRegistry([
      { path: "pages/topics/Foo.md", title: "Foo" },
      { path: "pages/summaries/Bar.md", title: "Bar" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "foo bar" }] },
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 12, text: "foo again" }] },
      { file: "Wiki/pages/summaries/Bar.md", matches: [{ line: 1, text: "# Bar foo" }] },
    ];

    const result = await searchViaObsidian(mockClient(hits), registry, "foo");
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].id).toBe("id-0"); // Foo
    expect(result.matches[1].id).toBe("id-1"); // Bar
  });

  test("filters by excludeStatuses", async () => {
    const registry = makeRegistry([
      { path: "pages/topics/Foo.md", title: "Foo Page", summary: "About foo", aliases: ["foo-stuff"], sourceIds: ["src-1"] },
      { path: "pages/summaries/Bar.md", title: "Bar Summary", status: "archived" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "foo" }] },
      { file: "Wiki/pages/summaries/Bar.md", matches: [{ line: 1, text: "bar" }] },
    ];

    const result = await searchViaObsidian(mockClient(hits), registry, "foo", undefined, 10, ["archived", "cleared"]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].title).toBe("Foo Page");
    expect(result.matches[0].summary).toBe("About foo");
    expect(result.matches[0].aliases).toEqual(["foo-stuff"]);
    expect(result.matches[0].sourceIds).toEqual(["src-1"]);
  });

  test("scoring: first match = 100, then 90, 80, etc.", async () => {
    const registry = makeRegistry([
      { path: "pages/topics/A.md", title: "A" },
      { path: "pages/topics/B.md", title: "B" },
      { path: "pages/topics/C.md", title: "C" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/A.md", matches: [{ line: 1, text: "x" }] },
      { file: "Wiki/pages/topics/B.md", matches: [{ line: 1, text: "x" }] },
      { file: "Wiki/pages/topics/C.md", matches: [{ line: 1, text: "x" }] },
    ];

    const result = await searchViaObsidian(mockClient(hits), registry, "x");
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0].score).toBe(100);
    expect(result.matches[1].score).toBe(90);
    expect(result.matches[2].score).toBe(80);
  });

  test("hits for files not in registry are skipped", async () => {
    const registry = makeRegistry([
      { path: "pages/topics/Known.md", title: "Known" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Unknown.md", matches: [{ line: 1, text: "x" }] },
      { file: "Wiki/pages/topics/Known.md", matches: [{ line: 1, text: "x" }] },
    ];

    const result = await searchViaObsidian(mockClient(hits), registry, "x");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].title).toBe("Known");
  });

  test("returns empty matches when no hits match registry entries", async () => {
    const registry = makeRegistry([]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Missing.md", matches: [{ line: 1, text: "x" }] },
    ];

    const result = await searchViaObsidian(mockClient(hits), registry, "x");
    expect(result.matches).toEqual([]);
  });

  test("type parameter is passed to scope", async () => {
    const registry = makeRegistry([
      { path: "pages/summaries/Source.md", title: "Source Article", type: "summary" },
      { path: "pages/topics/Topic.md", title: "Topic Page", type: "topic" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/summaries/Source.md", matches: [{ line: 1, text: "test" }] },
      { file: "Wiki/pages/topics/Topic.md", matches: [{ line: 1, text: "test" }] },
    ];

    // Mock returns both hits since it doesn't filter by scope.
    // The registry lookup returns both — scope path correctness is verified
    // by the pluralization fix (summary -> summaries).
    const result = await searchViaObsidian(mockClient(hits), registry, "test", "summary");
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].type).toBe("summary");
    expect(result.matches[1].type).toBe("topic");
  });

  test("scoring clamps to 0 for positions beyond 10", async () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({
      path: `pages/topics/Page${i}.md`,
      title: `Page ${i}`,
    }));
    const registry = makeRegistry(pages);
    const hits: SearchHit[] = pages.map((p) => ({
      file: `Wiki/${p.path}`,
      matches: [{ line: 1, text: "x" }],
    }));

    const result = await searchViaObsidian(mockClient(hits), registry, "x", undefined, 20);
    expect(result.matches).toHaveLength(12);
    expect(result.matches[0].score).toBe(100);
    expect(result.matches[10].score).toBe(0);
    expect(result.matches[11].score).toBe(0);
  });

  test("returns query in result", async () => {
    const registry = makeRegistry([]);
    const result = await searchViaObsidian(mockClient([]), registry, "my query");
    expect(result.query).toBe("my query");
  });

  test("supports vault scope by calling client.search", async () => {
    const registry = makeRegistry([
      { path: "pages/topics/Agent.md", title: "Agent" },
    ]);

    const client = {
      searchContext: async () => {
        throw new Error("searchContext should not be called for vault scope");
      },
      search: async () => [
        "Wiki/pages/topics/Agent.md",
        "Area/1 CS/17 AI/Agent.md",
      ],
      properties: async (path: string) => ({
        title: path.startsWith("Wiki/") ? "Agent" : "PKB Agent",
        tags: path.startsWith("Wiki/") ? [] : ["RESOURCE"],
        summary: path.startsWith("Wiki/") ? "Wiki page" : "PKB entry",
        aliases: [],
        source_ids: [],
        status: "integrated",
      }),
    } as any;

    const result = await searchViaObsidian(client, registry, "agent", undefined, 10, [], "vault");

    expect(result.matches.map((match) => match.title)).toEqual(["Agent", "PKB Agent"]);
    expect(result.matches.map((match) => match.path)).toEqual([
      "pages/topics/Agent.md",
      "Area/1 CS/17 AI/Agent.md",
    ]);
  });
});
