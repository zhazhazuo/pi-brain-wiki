import { describe, test, expect } from "bun:test";
import { searchViaObsidian } from "./search.ts";
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

  test("returns query in result", async () => {
    const registry = makeRegistry([]);
    const result = await searchViaObsidian(mockClient([]), registry, "my query");
    expect(result.query).toBe("my query");
  });
});
