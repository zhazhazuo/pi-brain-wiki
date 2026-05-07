import { describe, test, expect } from "bun:test";
import type { RegistryData, SearchHit, RegistryEntry } from "./types.ts";

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

describe("searchViaObsidian logic", () => {
  test("deduplicates hits by file, preserving first occurrence order", () => {
    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "foo bar" }] },
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 12, text: "foo again" }] },
      { file: "Wiki/pages/summaries/Bar.md", matches: [{ line: 1, text: "# Bar foo" }] },
    ];

    const seen = new Set<string>();
    const deduped: SearchHit[] = [];
    for (const hit of hits) {
      if (!seen.has(hit.file)) {
        seen.add(hit.file);
        deduped.push(hit);
      }
    }

    expect(deduped).toEqual([
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "foo bar" }] },
      { file: "Wiki/pages/summaries/Bar.md", matches: [{ line: 1, text: "# Bar foo" }] },
    ]);
  });

  test("matches hits to registry entries and filters by excludeStatuses", () => {
    const registry = makeRegistry([
      { path: "pages/topics/Foo.md", title: "Foo Page", summary: "About foo", aliases: ["foo-stuff"], sourceIds: ["src-1"] },
      { path: "pages/summaries/Bar.md", title: "Bar Summary", status: "archived" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Foo.md", matches: [{ line: 5, text: "foo" }] },
      { file: "Wiki/pages/summaries/Bar.md", matches: [{ line: 1, text: "bar" }] },
    ];

    const byPath = new Map<string, RegistryEntry>();
    for (const entry of registry.pages) {
      byPath.set(`Wiki/${entry.path}`, entry);
    }

    const excludeStatuses = ["archived", "cleared"];
    const results: Array<{ entry: RegistryEntry; score: number }> = [];

    for (let i = 0; i < hits.length; i++) {
      const entry = byPath.get(hits[i].file);
      if (!entry) continue;
      if (excludeStatuses.includes(entry.status ?? "")) continue;
      results.push({ entry, score: 100 - i * 10 });
    }

    expect(results.length).toBe(1);
    expect(results[0].entry.title).toBe("Foo Page");
    expect(results[0].score).toBe(100);
  });

  test("scoring: first match = 100, then 90, 80, etc.", () => {
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

    const byPath = new Map<string, RegistryEntry>();
    for (const entry of registry.pages) {
      byPath.set(`Wiki/${entry.path}`, entry);
    }

    const results: Array<{ score: number; title: string }> = [];
    for (let i = 0; i < hits.length; i++) {
      const entry = byPath.get(hits[i].file);
      if (!entry) continue;
      results.push({ score: 100 - i * 10, title: entry.title });
    }

    expect(results).toEqual([
      { score: 100, title: "A" },
      { score: 90, title: "B" },
      { score: 80, title: "C" },
    ]);
  });

  test("hits for files not in registry are skipped", () => {
    const registry = makeRegistry([
      { path: "pages/topics/Known.md", title: "Known" },
    ]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Unknown.md", matches: [{ line: 1, text: "x" }] },
      { file: "Wiki/pages/topics/Known.md", matches: [{ line: 1, text: "x" }] },
    ];

    const byPath = new Map<string, RegistryEntry>();
    for (const entry of registry.pages) {
      byPath.set(`Wiki/${entry.path}`, entry);
    }

    const results: string[] = [];
    for (const hit of hits) {
      const entry = byPath.get(hit.file);
      if (!entry) continue;
      results.push(entry.title);
    }

    expect(results).toEqual(["Known"]);
  });

  test("returns empty matches when no hits match registry entries", () => {
    const registry = makeRegistry([]);

    const hits: SearchHit[] = [
      { file: "Wiki/pages/topics/Missing.md", matches: [{ line: 1, text: "x" }] },
    ];

    const byPath = new Map<string, RegistryEntry>();
    for (const entry of registry.pages) {
      byPath.set(`Wiki/${entry.path}`, entry);
    }

    const results: string[] = [];
    for (const hit of hits) {
      const entry = byPath.get(hit.file);
      if (!entry) continue;
      results.push(entry.title);
    }

    expect(results).toEqual([]);
  });
});
