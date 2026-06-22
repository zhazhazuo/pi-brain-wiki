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

  test("requires a query for question intent", async () => {
    await expect(gatherExternalContext(context, {
      intent: "question",
    })).rejects.toThrow('Intent "question" requires a query');
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

  test("returns branchable architecture evidence with bounded search requests", async () => {
    const calls: Array<{ query: string; limit: number; includePaths: string[]; excludePaths: string[] }> = [];

    const result = await gatherExternalContext(context, {
      intent: "architecture",
      readTextFile: async (path) => path.endsWith("README.md") ? "# Sales Tool\n\nApp repo" : "{\"name\":\"sales-tool\"}",
      listRepoFiles: async ({ limit, includePaths, excludePaths }) => {
        expect(limit).toBe(5);
        expect(includePaths).toEqual(["src"]);
        expect(excludePaths).toEqual(["node_modules"]);
        return ["README.md", "package.json", "src/index.ts"];
      },
      searchRepo: async (query, options) => {
        calls.push({ query, ...options });
        return ["src/index.ts", "src/routes.ts"];
      },
      getRecentCommits: async () => [],
    });

    expect(calls).toEqual([{
      query: "sales tool",
      limit: 5,
      includePaths: ["src"],
      excludePaths: ["node_modules"],
    }]);
    expect(result.evidence).toContainEqual({
      kind: "search",
      query: "sales tool",
      path: "src/index.ts",
    });
  });

  test("builds architecture helpers from a thin exec adapter", async () => {
    const execCalls: Array<{ command: string; args: string[] }> = [];

    const result = await gatherExternalContext(context, {
      intent: "architecture",
      readTextFile: async (path) => path.endsWith("README.md") ? "# Sales Tool\n\nApp repo" : "{\"name\":\"sales-tool\"}",
      execCommand: async (command, args) => {
        execCalls.push({ command, args: [...args] });
        if (command !== "rg") {
          return { stdout: "", stderr: "unexpected command", code: 1 };
        }
        if (args.includes("--files")) {
          return {
            stdout: ["src/index.ts", "src/invoice.ts", "node_modules/ignored.js"].join("\n"),
            stderr: "",
            code: 0,
          };
        }
        return {
          stdout: ["src/index.ts", "src/routes.ts"].join("\n"),
          stderr: "",
          code: 0,
        };
      },
    } as any);

    expect(execCalls).toContainEqual({
      command: "rg",
      args: ["--files", "-g", "src/**", "-g", "!node_modules/**", "."],
    });
    expect(result.commands_used).toContain("listRepoFiles");
    expect(result.evidence).toContainEqual({
      kind: "note",
      note: "repo-files",
      paths: ["src/index.ts", "src/invoice.ts"],
    });
  });

  test("returns recent change evidence for handoff", async () => {
    const result = await gatherExternalContext({
      ...context,
      allowed_intents: [...context.allowed_intents, "handoff"],
    }, {
      intent: "handoff",
      readTextFile: async () => "# Sales Tool",
      listRepoFiles: async () => ["README.md"],
      searchRepo: async () => [],
      getRecentCommits: async ({ limit }) => {
        expect(limit).toBe(5);
        return ["abc123 Fix sales flow", "def456 Add docs"];
      },
    });

    expect(result.intent).toBe("handoff");
    expect(result.evidence).toContainEqual({
      kind: "commit",
      commit: "abc123 Fix sales flow",
    });
    expect(result.follow_up_suggestions).toContain("Ask a focused question about the next task or open issue.");
  });

  test("builds question and handoff helpers from a thin exec adapter", async () => {
    const question = await gatherExternalContext({
      ...context,
      allowed_intents: [...context.allowed_intents, "handoff"],
    }, {
      intent: "question",
      query: "invoice",
      execCommand: async (command, args) => {
        if (command === "rg") {
          expect(args).toEqual(["-l", "--no-messages", "-g", "src/**", "-g", "!node_modules/**", "invoice", "."]);
          return {
            stdout: "src/invoice.ts\nsrc/billing.ts",
            stderr: "",
            code: 0,
          };
        }
        return { stdout: "", stderr: "", code: 1 };
      },
    } as any);

    expect(question.evidence).toContainEqual({
      kind: "search",
      query: "invoice",
      path: "src/invoice.ts",
    });

    const handoff = await gatherExternalContext({
      ...context,
      allowed_intents: [...context.allowed_intents, "handoff"],
    }, {
      intent: "handoff",
      readTextFile: async () => "# Sales Tool",
      execCommand: async (command, args) => {
        if (command === "git") {
          expect(args).toEqual(["log", "-5", "--oneline"]);
          return {
            stdout: "abc123 Fix sales flow\ndef456 Add docs",
            stderr: "",
            code: 0,
          };
        }
        if (command === "rg" && args.includes("--files")) {
          return {
            stdout: "src/index.ts",
            stderr: "",
            code: 0,
          };
        }
        return { stdout: "", stderr: "", code: 1 };
      },
    } as any);

    expect(handoff.commands_used).toContain("getRecentCommits");
    expect(handoff.evidence).toContainEqual({
      kind: "commit",
      commit: "abc123 Fix sales flow",
    });
  });

  test("records limits_hit when helper results exceed caps", async () => {
    const result = await gatherExternalContext({
      ...context,
      seed_files: ["README.md", "package.json", "src/index.ts", "src/routes.ts"],
    }, {
      intent: "architecture",
      readTextFile: async () => "content",
      listRepoFiles: async () => ["README.md", "package.json", "src/index.ts", "src/routes.ts", "src/app.ts", "src/lib.ts"],
      searchRepo: async () => ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts", "src/f.ts"],
      getRecentCommits: async () => [],
    });

    expect(result.limits_hit).toContain("seed_files:3");
    expect(result.limits_hit).toContain("repo-files:5");
    expect(result.limits_hit).toContain("search-results:5");
    expect(result.evidence.filter((item) => item.kind === "search")).toHaveLength(5);
  });

  test("degrades deterministically when helpers are missing", async () => {
    const result = await gatherExternalContext({
      ...context,
      allowed_intents: [...context.allowed_intents, "recent_changes"],
    }, {
      intent: "recent_changes",
    });

    expect(result.commands_used).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.limits_hit).toEqual(["commits-unavailable"]);
    expect(result.summary).toEqual(["No recent commits helper was available for Sales Tool Application."]);
  });
});
