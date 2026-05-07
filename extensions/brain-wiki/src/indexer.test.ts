import { describe, test, expect } from "bun:test";
import { enrichWithBacklinks } from "./indexer.ts";
import type { RegistryEntry, BacklinkResult } from "./types.ts";

function makePage(overrides: Partial<RegistryEntry> & { id: string; path: string; title: string }): RegistryEntry {
  return {
    type: "topic",
    aliases: [],
    summary: "",
    status: "",
    tags: [],
    sourceIds: [],
    linksOut: [],
    headings: [],
    wordCount: 0,
    externalBacklinks: 0,
    externalSources: [],
    ...overrides,
  };
}

describe("enrichWithBacklinks", () => {
  test("filters out Wiki/ internal links, sorts by count, caps at 5 sources", async () => {
    const pages: RegistryEntry[] = [
      makePage({ id: "1", path: "pages/topics/Foo.md", title: "Foo" }),
      makePage({ id: "2", path: "pages/topics/Bar.md", title: "Bar" }),
    ];

    const mockBacklinks = new Map<string, BacklinkResult[]>();
    mockBacklinks.set("Wiki/pages/topics/Foo.md", [
      { file: "Area/Math.md", count: 5 },
      { file: "Project/Research.md", count: 3 },
      { file: "Wiki/pages/topics/Bar.md", count: 2 },
      { file: "Resource/Paper.md", count: 1 },
    ]);
    mockBacklinks.set("Wiki/pages/topics/Bar.md", [
      { file: "Area/Design.md", count: 7 },
      { file: "Area/Notes.md", count: 6 },
      { file: "Draft/Idea.md", count: 4 },
      { file: "Project/Plan.md", count: 4 },
      { file: "Resource/Book.md", count: 3 },
      { file: "Area/Extra.md", count: 2 },
    ]);

    const mockClient = {
      backlinks: async (file: string) => mockBacklinks.get(file) ?? [],
      config: { socketPath: "", vaultCwd: "", timeout: 0 },
    };

    await enrichWithBacklinks(mockClient as any, pages);

    expect(pages[0].externalBacklinks).toBe(3);
    expect(pages[0].externalSources).toEqual([
      "Area/Math.md", "Project/Research.md", "Resource/Paper.md",
    ]);

    expect(pages[1].externalBacklinks).toBe(6);
    expect(pages[1].externalSources).toEqual([
      "Area/Design.md", "Area/Notes.md", "Draft/Idea.md", "Project/Plan.md", "Resource/Book.md",
    ]);
    expect(pages[1].externalSources.length).toBe(5);
  });

  test("pages with no backlinks get zero/empty", async () => {
    const pages: RegistryEntry[] = [
      makePage({ id: "3", path: "pages/topics/Empty.md", title: "Empty" }),
    ];

    const mockClient = {
      backlinks: async (_file: string) => [],
      config: { socketPath: "", vaultCwd: "", timeout: 0 },
    };

    await enrichWithBacklinks(mockClient as any, pages);

    expect(pages[0].externalBacklinks).toBe(0);
    expect(pages[0].externalSources).toEqual([]);
  });

  test("all Wiki/ internal backlinks result in zero external", async () => {
    const pages: RegistryEntry[] = [
      makePage({ id: "4", path: "pages/topics/Internal.md", title: "Internal" }),
    ];

    const mockBacklinks = new Map<string, BacklinkResult[]>();
    mockBacklinks.set("Wiki/pages/topics/Internal.md", [
      { file: "Wiki/pages/topics/A.md", count: 3 },
      { file: "Wiki/pages/summaries/B.md", count: 2 },
    ]);

    const mockClient = {
      backlinks: async (file: string) => mockBacklinks.get(file) ?? [],
      config: { socketPath: "", vaultCwd: "", timeout: 0 },
    };

    await enrichWithBacklinks(mockClient as any, pages);

    expect(pages[0].externalBacklinks).toBe(0);
    expect(pages[0].externalSources).toEqual([]);
  });

  test("backlinks error is caught and defaults to zero/empty", async () => {
    const pages: RegistryEntry[] = [
      makePage({ id: "5", path: "pages/topics/Broken.md", title: "Broken" }),
    ];

    const mockClient = {
      backlinks: async (_file: string) => { throw new Error("connection lost"); },
      config: { socketPath: "", vaultCwd: "", timeout: 0 },
    };

    await enrichWithBacklinks(mockClient as any, pages);

    expect(pages[0].externalBacklinks).toBe(0);
    expect(pages[0].externalSources).toEqual([]);
  });
});
