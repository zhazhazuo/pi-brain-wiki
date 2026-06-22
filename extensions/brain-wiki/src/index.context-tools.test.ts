import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import brainWikiExtension from "../index.ts";

type RegisteredTool = {
  name: string;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: ((update: unknown) => void) | undefined,
    ctx: { cwd: string },
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
    details: Record<string, unknown>;
  }>;
};

async function makeWikiRoot() {
  const root = await mkdtemp(join(tmpdir(), "brain-wiki-context-tools-"));
  const repoRoot = await mkdtemp(join(tmpdir(), "brain-wiki-context-repo-"));
  await writeFile(join(repoRoot, "README.md"), "# Sales Tool\n\nApp repo\n");

  await mkdir(join(root, ".wiki"), { recursive: true });
  await writeFile(
    join(root, ".wiki", "config.json"),
    JSON.stringify(
      {
        version: 1,
        title: "Test Wiki",
        domain: "General",
        timezone: "UTC",
        paths: {
          inbox: "inbox",
          pages: "pages",
          meta: "meta",
          archive: "archive",
        },
        pageTypes: {
          summary: "pages/summaries",
          topic: "pages/topics",
          plan: "pages/plans",
          review: "pages/reviews",
          workflow: "pages/workflows",
        },
        templates: {
          summary: ".wiki/templates/summary.md",
          topic: ".wiki/templates/topic.md",
          plan: ".wiki/templates/plan.md",
          review: ".wiki/templates/review.md",
          workflow: ".wiki/templates/workflow.md",
        },
        linkStyle: "wikilink-folder-qualified",
        citationStyle: "source-page-id-link",
        protect: [],
        allowExternal: [],
        search: { defaultLimit: 10 },
        contexts: {
          "sales-tool-application": {
            label: "Sales Tool Application",
            pkb_note: "Area/5 Work/53 Visable/Sales Tool Application.md",
            repo_key: "sales_tool_application_repo",
            allowed_intents: ["overview", "architecture", "question", "handoff"],
            seed_files: ["README.md"],
          },
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(root, ".wiki", "env.local.json"),
    JSON.stringify(
      {
        repos: {
          sales_tool_application_repo: repoRoot,
        },
      },
      null,
      2,
    ),
  );

  return { root, repoRoot };
}

function registerTools() {
  const tools = new Map<string, RegisteredTool>();
  const pi = {
    on: () => undefined,
    registerTool: (tool: RegisteredTool) => {
      tools.set(tool.name, tool);
    },
    registerCommand: () => undefined,
    exec: async (command: string, args?: string[]) => {
      if (command === "git" && args?.[0] === "log") {
        const requested = Number(args[1]?.replace(/^-/, "") || "0");
        const commits = [
          "abc123 Fix sales flow",
          "def456 Add docs",
        ];
        return {
          stdout: commits.slice(0, requested).join("\n"),
          stderr: "",
          code: 0,
        };
      }

      return {
        stdout: "",
        stderr: `unexpected command: ${command} ${(args ?? []).join(" ")}`,
        code: 1,
      };
    },
  } as any;

  brainWikiExtension(pi);

  return tools;
}

describe("external context tools", () => {
  test("executes resolve and gather through the extension tool layer", async () => {
    const tools = registerTools();
    const { root, repoRoot } = await makeWikiRoot();
    const resolveTool = tools.get("wiki_context_resolve");
    const gatherTool = tools.get("wiki_context_gather");

    expect(resolveTool).toBeDefined();
    expect(gatherTool).toBeDefined();

    const resolved = await resolveTool!.execute(
      "resolve-call",
      { context_id: "sales-tool-application" },
      undefined,
      undefined,
      { cwd: root },
    );

    expect(resolved.details.context_id).toBe("sales-tool-application");
    expect(resolved.details.repo_path).toBe(repoRoot);
    expect(resolved.content[0]?.text).toContain("Resolved external context: Sales Tool Application");

    const gathered = await gatherTool!.execute(
      "gather-call",
      {
        context_id: "sales-tool-application",
        intent: "overview",
      },
      undefined,
      undefined,
      { cwd: root },
    );

    expect(gathered.details.intent).toBe("overview");
    expect(gathered.details.context_id).toBe("sales-tool-application");
    expect(Array.isArray(gathered.details.summary)).toBe(true);
    expect(gathered.details.files_read).toContain("README.md");
    expect(gathered.details.commands_used).toContain("readTextFile");
    expect(gathered.content[0]?.text).toContain("External context gather: Sales Tool Application");
    expect(gathered.content[0]?.text).toContain("Intent: overview");

    const handoff = await gatherTool!.execute(
      "handoff-call",
      {
        context_id: "sales-tool-application",
        intent: "handoff",
        limit_commits: 1,
      },
      undefined,
      undefined,
      { cwd: root },
    );

    expect(handoff.details.intent).toBe("handoff");
    expect(handoff.details.commands_used).toContain("getRecentCommits");
    expect(handoff.details.evidence).toContainEqual({
      kind: "commit",
      commit: "abc123 Fix sales flow",
    });
    expect(handoff.details.evidence).not.toContainEqual({
      kind: "commit",
      commit: "def456 Add docs",
    });
  });
});
