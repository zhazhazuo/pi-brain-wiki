import { describe, expect, test } from "bun:test";
import brainWikiExtension from "../index.ts";

describe("external context tools", () => {
  test("registers context resolve and gather tools", () => {
    const tools: string[] = [];
    const pi = {
      on: () => undefined,
      registerTool: (tool: { name: string }) => {
        tools.push(tool.name);
      },
      registerCommand: () => undefined,
    } as any;

    brainWikiExtension(pi);

    expect(tools).toContain("wiki_context_resolve");
    expect(tools).toContain("wiki_context_gather");
  });
});
