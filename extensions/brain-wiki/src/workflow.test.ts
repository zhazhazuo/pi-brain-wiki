import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  createWorkflow,
  rebuildWorkflowRoutes,
  renderWorkflowBody,
} from "./workflow.ts";
import type { RegistryData, RegistryEntry } from "./types.ts";

function makeRegistry(pages: Partial<RegistryEntry>[] = []): RegistryData {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    pages: pages.map((page, index) => ({
      id: String(page.id ?? `id-${index}`),
      type: page.type ?? "workflow",
      path: page.path ?? `pages/workflows/workflow-${index}.md`,
      title: page.title ?? `Workflow ${index}`,
      aliases: page.aliases ?? [],
      summary: page.summary ?? "",
      status: page.status,
      tags: page.tags ?? [],
      sourceIds: page.sourceIds ?? [],
      linksOut: [],
      headings: page.headings ?? [],
      wordCount: page.wordCount ?? 0,
      externalBacklinks: page.externalBacklinks ?? 0,
      externalSources: page.externalSources ?? [],
    })),
  };
}

describe("workflow generation", () => {
  test("renders the standard workflow YAML block", () => {
    const body = renderWorkflowBody({
      id: "workflow-weekly-okr-report",
      title: "Weekly OKR Report",
      status: "active",
      triggers: ["summarize my week"],
      goal: "Draft a weekly report for my team leader.",
      inputs: ["recent activity", "OKR pages"],
      steps: ["scan activity", "group work by OKR"],
      output: "Team-leader weekly report",
      constraints: ["Ask before submitting"],
    });

    expect(body).toContain("# Weekly OKR Report");
    expect(body).toContain("```yaml");
    expect(body).toContain("version: 1");
    expect(body).toContain("id: workflow-weekly-okr-report");
    expect(body).toContain('- "summarize my week"');
    expect(body).toContain("## Notes");
  });

  test("creates a workflow page with standard frontmatter", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-workflow-"));

    const result = await createWorkflow(root, makeRegistry(), {
      title: "Weekly OKR Report",
      status: "active",
      triggers: ["summarize my week", "weekly report"],
      goal: "Draft a weekly report for my team leader.",
      inputs: ["recent activity", "OKR pages"],
      steps: ["scan activity", "group work by OKR"],
      output: "Team-leader weekly report",
      constraints: ["Ask before submitting"],
      tags: ["okr", "weekly"],
    });

    expect(result.created).toBe(true);
    expect(result.path).toBe("pages/workflows/weekly-okr-report.md");
    expect(result.id).toBe("workflow-weekly-okr-report");

    const raw = await readFile(join(root, result.path!), "utf8");
    expect(raw).toContain("type: workflow");
    expect(raw).toContain("status: active");
    expect(raw).toContain("triggers:");
    expect(raw).toContain("- summarize my week");
    expect(raw).toContain("summary: Draft a weekly report for my team leader.");
    expect(raw).toContain("```yaml");
  });

  test("reports existing workflow title conflicts instead of duplicating", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-workflow-"));
    const registry = makeRegistry([
      {
        id: "workflow-weekly-okr-report",
        title: "Weekly OKR Report",
        path: "pages/workflows/weekly-okr-report.md",
      },
    ]);

    const result = await createWorkflow(root, registry, {
      title: "Weekly OKR Report",
      triggers: ["summarize my week"],
      goal: "Draft a weekly report.",
      inputs: ["recent activity"],
      steps: ["scan activity"],
      output: "Report",
    });

    expect(result.created).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.candidates?.[0].path).toBe("pages/workflows/weekly-okr-report.md");
  });

  test("generates a compact workflow route page", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-workflow-"));
    const registry = makeRegistry([
      {
        id: "workflow-weekly-okr-report",
        title: "Weekly OKR Report",
        path: "pages/workflows/weekly-okr-report.md",
        status: "active",
        aliases: ["summarize my week", "weekly report"],
        summary: "Draft a weekly OKR report.",
      },
      {
        id: "workflow-review-prep",
        title: "Review Prep",
        path: "pages/workflows/review-prep.md",
        status: "draft",
        aliases: ["prepare review notes"],
      },
    ]);

    const routePath = await rebuildWorkflowRoutes(root, registry);
    const raw = await readFile(join(root, routePath), "utf8");

    expect(routePath).toBe("meta/workflows.md");
    expect(raw).toContain("# Workflow Routes");
    expect(raw).toContain("| summarize my week | [[workflows/weekly-okr-report|Weekly OKR Report]] | Draft a weekly OKR report. |");
    expect(raw).toContain("| prepare review notes | [[workflows/review-prep|Review Prep]] |  |");
  });
});
