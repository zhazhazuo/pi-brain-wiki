import { describe, expect, test } from "bun:test";
import { gatherExternalContext } from "./context-gather.ts";
import type { ResolvedExternalContext } from "./types.ts";

const context: ResolvedExternalContext = {
  context_id: "sales-tool-application",
  label: "Sales Tool Application",
  pkb_note: "Area/5 Work/53 Visable/Sales Tool Application.md",
  repo_key: "sales_tool_application_repo",
  repo_path: "/tmp/sales-tool-app",
  allowed_intents: ["overview", "architecture", "implementation", "question"],
  seed_files: ["README.md", "package.json"],
  include_paths: ["src"],
  exclude_paths: ["node_modules"],
  search_terms: ["sales tool"],
};

describe("gatherExternalContext", () => {
  test("rejects disallowed intents", async () => {
    await expect(gatherExternalContext(context, {
      intent: "recent_changes",
    })).rejects.toThrow("Intent not allowed");
  });

  test("requires a query for implementation intent", async () => {
    await expect(gatherExternalContext(context, {
      intent: "implementation",
    })).rejects.toThrow("requires a query");
  });

  test("returns overview steps and structured files_read", async () => {
    const result = await gatherExternalContext(context, {
      intent: "overview",
      readTextFile: async (path) => path.endsWith("README.md") ? "# Sales Tool\n\nApp repo" : "{\"name\":\"sales-tool\"}",
      listRepoFiles: async () => ["README.md", "package.json", "src/index.ts"],
      searchRepo: async () => [],
      getRecentCommits: async () => [],
    });

    expect(result.intent).toBe("overview");
    expect(result.files_read).toContain("README.md");
    expect(result.summary.length).toBeGreaterThan(0);
  });
});
