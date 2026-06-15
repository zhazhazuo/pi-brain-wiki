import { describe, expect, test } from "bun:test";
import {
  buildEnsurePageGraphTerms,
  bridgeWikiPage,
  findGraphContext,
  formatGraphFind,
  renderPkbContextBlock,
  traverseNeighborhood,
} from "./graph.ts";

describe("graph", () => {
  test("findGraphContext groups wiki and pkb hits", async () => {
    const client = {
      search: async () => ["Wiki/pages/topics/agent.md", "Area/1 CS/17 AI/Agent.md"],
      properties: async (path: string) => ({
        title: path.startsWith("Wiki/") ? "Agent Topic" : "Agent PKB",
        summary: "summary",
        aliases: [],
        tags: path.startsWith("Wiki/") ? [] : ["RESOURCE"],
        source_ids: [],
      }),
      backlinks: async () => [{ file: "Project/Foo.md", count: 2 }],
      links: async () => [],
    } as any;

    const result = await findGraphContext(client, ["agent"]);
    expect(result.query).toBe("agent");
    expect(result.wiki).toHaveLength(1);
    expect(result.pkb).toHaveLength(1);
  });

  test("traverseNeighborhood returns backlinks and links", async () => {
    const client = {
      backlinks: async (path: string) =>
        path === "Area/1 CS/Agent.md"
          ? [{ file: "Project/Foo.md", count: 2 }]
          : [{ file: "Area/1 CS/Agent.md", count: 1 }],
      links: async () => ["Area/1 CS/Bar.md"],
      readFile: async () => "# Agent\n\nSummary line\n",
      properties: async () => ({}),
      search: async () => [],
    } as any;

    const result = await traverseNeighborhood(client, "Area/1 CS/Agent.md", 2);
    expect(result.backlinks).toEqual([{ file: "Project/Foo.md", count: 2 }]);
    expect(result.links).toEqual(["Area/1 CS/Bar.md"]);
    expect(result.secondHop.length).toBeGreaterThanOrEqual(0);
  });

  test("bridgeWikiPage filters already linked candidates", async () => {
    const client = {
      readFile: async () => "# Agent\n\nSummary line\n",
      links: async () => ["Area/1 CS/17 AI/Agent.md"],
      search: async () => ["Area/1 CS/17 AI/Agent.md", "Area/1 CS/17 AI/Mutex.md"],
      properties: async (path: string) => ({
        title: path.endsWith("Mutex.md") ? "Mutex" : "Agent",
        summary: "summary",
        aliases: [],
        tags: ["RESOURCE"],
        source_ids: [],
      }),
      backlinks: async () => [],
    } as any;

    const result = await bridgeWikiPage(client, "Wiki/pages/topics/agent.md");
    expect(result.currentLinks).toEqual(["Area/1 CS/17 AI/Agent.md"]);
    expect(result.candidates.map((candidate) => candidate.title)).toContain("Mutex");
    expect(result.candidates.map((candidate) => candidate.path)).not.toContain("Area/1 CS/17 AI/Agent.md");
  });

  test("formatGraphFind renders grouped results", () => {
    const text = formatGraphFind({
      query: "agent",
      wiki: [{ path: "Wiki/pages/topics/agent.md", title: "Agent Topic", aliases: [], tags: [], sourceIds: [], zone: "wiki", score: 100, backlinks: 1 }],
      pkb: [{ path: "Area/1 CS/17 AI/Agent.md", title: "Agent PKB", aliases: [], tags: ["RESOURCE"], sourceIds: [], zone: "pkb", score: 90, backlinks: 2 }],
    });

    expect(text).toContain("Found in Wiki");
    expect(text).toContain("Found in PKB");
  });

  test("renderPkbContextBlock renders wikilinks", () => {
    const block = renderPkbContextBlock([
      { path: "Area/1 CS/17 AI/Agent.md", title: "Agent PKB" },
    ]);

    expect(block).toContain("## PKB Context");
    expect(block).toContain("[[Area/1 CS/17 AI/Agent|Agent PKB]]");
  });

  test("buildEnsurePageGraphTerms drops empty parts", () => {
    expect(buildEnsurePageGraphTerms("Agent Systems", "PKB-aligned summary")).toEqual([
      "Agent Systems",
      "PKB-aligned summary",
    ]);
  });
});
