import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveExternalContext } from "./context-resolve.ts";

async function makeRoot() {
  const root = await mkdtemp(join(tmpdir(), "brain-wiki-resolve-"));
  await mkdir(join(root, ".wiki"), { recursive: true });
  await writeFile(join(root, ".wiki", "config.json"), JSON.stringify({
    version: 1,
    title: "Test Wiki",
    domain: "General",
    timezone: "UTC",
    paths: { inbox: "inbox", pages: "pages", meta: "meta", archive: "archive" },
    pageTypes: { summary: "pages/summaries", topic: "pages/topics", plan: "pages/plans", review: "pages/reviews", workflow: "pages/workflows" },
    templates: { summary: ".wiki/templates/summary.md", topic: ".wiki/templates/topic.md", plan: ".wiki/templates/plan.md", review: ".wiki/templates/review.md", workflow: ".wiki/templates/workflow.md" },
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
        allowed_intents: ["overview", "architecture", "question"],
      },
    },
  }, null, 2));
  return root;
}

describe("resolveExternalContext", () => {
  test("resolves a repo path from context id", async () => {
    const root = await makeRoot();
    const repoRoot = await mkdtemp(join(tmpdir(), "sales-tool-repo-"));
    await writeFile(join(root, ".wiki", "env.local.json"), JSON.stringify({
      repos: {
        sales_tool_application_repo: repoRoot,
      },
    }, null, 2));

    const result = await resolveExternalContext(root, {
      context_id: "sales-tool-application",
    });

    expect(result.context_id).toBe("sales-tool-application");
    expect(result.repo_path).toBe(repoRoot);
  });

  test("fails closed when repo mapping is missing", async () => {
    const root = await makeRoot();
    await expect(resolveExternalContext(root, {
      context_id: "sales-tool-application",
    })).rejects.toThrow("No local repo path configured");
  });
});
