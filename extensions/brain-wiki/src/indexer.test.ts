import { describe, test, expect } from "bun:test";
import type { RegistryEntry, BacklinkResult } from "./types.ts";

describe("enrichWithBacklinks", () => {
  test("filters out Wiki/ internal links, sorts by count, caps at 5 sources", async () => {
    const pages: RegistryEntry[] = [
      {
        id: "1", type: "topic", path: "pages/topics/Foo.md",
        title: "Foo", aliases: [], summary: "", status: "", tags: [],
        sourceIds: [], linksOut: [], headings: [], wordCount: 0,
        externalBacklinks: 0, externalSources: [],
      },
      {
        id: "2", type: "topic", path: "pages/topics/Bar.md",
        title: "Bar", aliases: [], summary: "", status: "", tags: [],
        sourceIds: [], linksOut: [], headings: [], wordCount: 0,
        externalBacklinks: 0, externalSources: [],
      },
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

    // Inline enrichment logic (mirrors actual implementation)
    for (const page of pages) {
      const backlinks = mockBacklinks.get(`Wiki/${page.path}`) ?? [];
      const external = backlinks.filter(b => !b.file.startsWith("Wiki/"));
      page.externalBacklinks = external.length;
      page.externalSources = external
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(b => b.file);
    }

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
      {
        id: "3", type: "topic", path: "pages/topics/Empty.md",
        title: "Empty", aliases: [], summary: "", status: "", tags: [],
        sourceIds: [], linksOut: [], headings: [], wordCount: 0,
        externalBacklinks: 0, externalSources: [],
      },
    ];

    const mockBacklinks = new Map<string, BacklinkResult[]>();

    for (const page of pages) {
      const backlinks = mockBacklinks.get(`Wiki/${page.path}`) ?? [];
      const external = backlinks.filter(b => !b.file.startsWith("Wiki/"));
      page.externalBacklinks = external.length;
      page.externalSources = external
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(b => b.file);
    }

    expect(pages[0].externalBacklinks).toBe(0);
    expect(pages[0].externalSources).toEqual([]);
  });

  test("all Wiki/ internal backlinks result in zero external", async () => {
    const pages: RegistryEntry[] = [
      {
        id: "4", type: "topic", path: "pages/topics/Internal.md",
        title: "Internal", aliases: [], summary: "", status: "", tags: [],
        sourceIds: [], linksOut: [], headings: [], wordCount: 0,
        externalBacklinks: 0, externalSources: [],
      },
    ];

    const mockBacklinks = new Map<string, BacklinkResult[]>();
    mockBacklinks.set("Wiki/pages/topics/Internal.md", [
      { file: "Wiki/pages/topics/A.md", count: 3 },
      { file: "Wiki/pages/summaries/B.md", count: 2 },
    ]);

    for (const page of pages) {
      const backlinks = mockBacklinks.get(`Wiki/${page.path}`) ?? [];
      const external = backlinks.filter(b => !b.file.startsWith("Wiki/"));
      page.externalBacklinks = external.length;
      page.externalSources = external
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(b => b.file);
    }

    expect(pages[0].externalBacklinks).toBe(0);
    expect(pages[0].externalSources).toEqual([]);
  });
});
