import { describe, expect, test } from "bun:test";
import {
  clearGraphBridgeRequirement,
  markCaptureRequiresGraphBridge,
  shouldBlockWikiMutation,
  shouldBlockWikiPageCreate,
} from "./workflow-gate.ts";

describe("workflow gate", () => {
  test("blocks wiki page edits after capture until graph bridge is satisfied", () => {
    const root = "/vault/Wiki";
    markCaptureRequiresGraphBridge(root);

    const result = shouldBlockWikiMutation(
      root,
      "edit",
      { path: "Wiki/pages/topics/agentic-code-review.md" },
      "/vault",
    );

    expect(result.block).toBe(true);
    expect(result.reason).toContain("wiki_graph_traverse or wiki_graph_bridge");
  });

  test("allows wiki page edits once the bridge requirement is cleared", () => {
    const root = "/vault/Wiki";
    markCaptureRequiresGraphBridge(root);
    clearGraphBridgeRequirement(root);

    const result = shouldBlockWikiMutation(
      root,
      "edit",
      { path: "Wiki/pages/topics/agentic-code-review.md" },
      "/vault",
    );

    expect(result.block).toBe(false);
  });

  test("blocks creating wiki pages while bridge requirement is pending", () => {
    const root = "/vault/Wiki";
    markCaptureRequiresGraphBridge(root);

    const result = shouldBlockWikiPageCreate(root, true);

    expect(result.block).toBe(true);
    expect(result.reason).toContain("creating new wiki pages");
  });
});
