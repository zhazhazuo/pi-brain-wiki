import { describe, expect, test } from "bun:test";
import {
  appendExternalContextHintsToGraphFind,
  findContextForPkbNote,
  formatExternalContextCatalog,
  listConfiguredContexts,
} from "./context-guide.ts";
import type { GraphContextResult } from "./types.ts";

const contexts = {
  "sales-tool-application": {
    label: "Sales Tool Application",
    pkb_note: "Area/5 Work/53 Visable/Sales Tool Application.md",
    repo_key: "sales_tool_application_repo",
    allowed_intents: ["overview", "architecture"] as ("overview" | "architecture")[],
  },
};

describe("context-guide", () => {
  test("lists configured contexts in stable order", () => {
    expect(listConfiguredContexts(contexts)).toEqual([
      {
        context_id: "sales-tool-application",
        label: "Sales Tool Application",
        pkb_note: "Area/5 Work/53 Visable/Sales Tool Application.md",
        allowed_intents: ["overview", "architecture"],
      },
    ]);
  });

  test("finds context by PKB note path variants", () => {
    expect(findContextForPkbNote(contexts, "Area/5 Work/53 Visable/Sales Tool Application")?.context_id)
      .toBe("sales-tool-application");
    expect(findContextForPkbNote(contexts, "Area/5 Work/53 Visable/Sales Tool Application.md")?.context_id)
      .toBe("sales-tool-application");
  });

  test("formats catalog with access instructions", () => {
    const text = formatExternalContextCatalog(listConfiguredContexts(contexts));
    expect(text).toContain("wiki_context_resolve");
    expect(text).toContain("sales-tool-application");
    expect(text).toContain("map-external-context");
  });

  test("appends graph hints when PKB hits match configured contexts", () => {
    const result: GraphContextResult = {
      query: "sales tool",
      wiki: [],
      pkb: [{
        path: "Area/5 Work/53 Visable/Sales Tool Application.md",
        title: "Sales Tool Application",
        aliases: [],
        tags: [],
        sourceIds: [],
        zone: "pkb",
        score: 100,
        backlinks: 0,
      }],
    };

    const text = appendExternalContextHintsToGraphFind(
      "Graph discovery for: sales tool",
      result,
      contexts,
    );

    expect(text).toContain("External repo context available");
    expect(text).toContain('context_id: "sales-tool-application"');
  });
});
