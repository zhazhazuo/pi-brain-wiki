import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectTemplate, validateProjectFrontmatter } from "./project-schema.ts";
import { formatProjectTitleForWeek, syncProject } from "./project-sync.ts";

function projectMarkdown(overrides: Record<string, string> = {}) {
  return [
    "---",
    `type: ${overrides.type ?? "project"}`,
    `title: ${overrides.title ?? "Launch Atlas"}`,
    `status: ${overrides.status ?? "active"}`,
    `created: ${overrides.created ?? "2026-06-18"}`,
    `updated: ${overrides.updated ?? "2026-06-18"}`,
    `area: ${overrides.area ?? "[[Area/Product]]"}`,
    `priority: ${overrides.priority ?? "high"}`,
    `deadline: ${overrides.deadline ?? ""}`,
    `next_action: ${overrides.next_action ?? "[[Project/w25-Launch Atlas/notes#Kickoff]]"}`,
    `review_after: ${overrides.review_after ?? ""}`,
    "resources:",
    "  - [[Resource/PRD]]",
    "related_projects: []",
    "tags:",
    "  - project",
    "---",
    `# ${overrides.title ?? "Launch Atlas"}`,
    "",
  ].join("\n");
}

describe("project schema", () => {
  test("creates the deterministic four-file project template", async () => {
    const template = buildProjectTemplate("Launch Atlas", new Date("2026-06-18T12:00:00Z"));

    expect(Object.keys(template).sort()).toEqual([
      "notes.md",
      "project.md",
      "tasks.md",
      "timeline.md",
    ]);
    expect(template["project.md"]).toContain("type: project");
    expect(template["project.md"]).toContain("status: idea");
    expect(template["project.md"]).toContain("## Active Links");
    expect(template["tasks.md"]).toContain("# Launch Atlas Tasks");
    expect(template["timeline.md"]).toContain("# Launch Atlas Timeline");
    expect(template["notes.md"]).toContain("# Launch Atlas Notes");
  });

  test("rejects project frontmatter without next_action for active work", () => {
    const result = validateProjectFrontmatter({
      type: "project",
      title: "Launch Atlas",
      status: "active",
      created: "2026-06-18",
      updated: "2026-06-18",
      area: "[[Area/Product]]",
      priority: "high",
      deadline: "",
      next_action: "",
      review_after: "",
      resources: ["[[Resource/PRD]]"],
      related_projects: [],
      tags: ["project"],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("next_action is required when status is active");
  });
});

describe("syncProject Obsidian IO", () => {
  test("formats project titles with a zero-padded ISO week prefix", () => {
    expect(formatProjectTitleForWeek("Project Title", new Date("2026-01-14T12:00:00Z"))).toBe("w03-Project Title");
  });

  test("create_project writes project.md, tasks.md, timeline.md, and notes.md", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      create: async (...args: unknown[]) => { calls.push({ method: "create", args }); },
    } as any;

    await syncProject("/vault/Wiki", "create_project", "Launch Atlas", undefined, client);

    expect(calls.map((call) => call.args[0])).toEqual([
      "Project/w25-Launch Atlas/project.md",
      "Project/w25-Launch Atlas/tasks.md",
      "Project/w25-Launch Atlas/timeline.md",
      "Project/w25-Launch Atlas/notes.md",
    ]);
  });

  test("rejects create_project without a client", async () => {
    await expect(syncProject("/vault/Wiki", "create_project", "Project Title")).rejects.toThrow(
      "Obsidian client required",
    );
  });

  test("scans same-named project files and reports future-mode next actions", async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), "brain-wiki-project-"));
    const wikiRoot = join(vaultRoot, "Wiki");
    const projectDir = join(vaultRoot, "Project", "Sales Tool Data Center");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, "Sales Tool Data Center.md"),
      [
        "---",
        "type: project",
        "status: active",
        "date: 2026-05-27",
        "project: Sales Tool Data Center",
        "priority: high",
        "deadline: 2026-05-29",
        "next_action: Prepare showcase script",
        "---",
        "# Sales Tool Data Center",
      ].join("\n"),
      "utf8",
    );

    const result = await syncProject(wikiRoot, "scan");

    expect(result.projects).toEqual([
      {
        path: "Sales Tool Data Center",
        mainPath: "Sales Tool Data Center/Sales Tool Data Center.md",
        title: "Sales Tool Data Center",
        status: "active",
        priority: "high",
        deadline: "2026-05-29",
        nextAction: "Prepare showcase script",
        lastAction: "Prepare showcase script",
        updated: null,
      },
    ]);
  });

  test("scans newly created project.md files from the deterministic template", async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), "brain-wiki-project-template-"));
    const wikiRoot = join(vaultRoot, "Wiki");
    const projectDir = join(vaultRoot, "Project", "w25-Launch Atlas");
    await mkdir(projectDir, { recursive: true });
    const template = buildProjectTemplate("Launch Atlas", new Date("2026-06-18T12:00:00Z"));
    for (const [name, content] of Object.entries(template)) {
      await writeFile(join(projectDir, name), content, "utf8");
    }

    const result = await syncProject(wikiRoot, "scan");

    expect(result.projects).toEqual([
      {
        path: "w25-Launch Atlas",
        mainPath: "w25-Launch Atlas/project.md",
        title: "Launch Atlas",
        status: "idea",
        priority: "medium",
        deadline: null,
        nextAction: null,
        lastAction: null,
        updated: "2026-06-18",
      },
    ]);
  });

  test("reviews projects using future-mode weekly control questions", async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), "brain-wiki-project-review-"));
    const wikiRoot = join(vaultRoot, "Wiki");
    const projectRoot = join(vaultRoot, "Project");
    await mkdir(join(projectRoot, "Active Without Action"), { recursive: true });
    await mkdir(join(projectRoot, "Completed Work"), { recursive: true });
    await writeFile(
      join(projectRoot, "Active Without Action", "Active Without Action.md"),
      [
        "---",
        "type: project",
        "status: active",
        "date: 2026-05-27",
        "project: Active Without Action",
        "priority: medium",
        "---",
        "# Active Without Action",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(projectRoot, "Completed Work", "Completed Work.md"),
      [
        "---",
        "type: project",
        "status: complete",
        "date: 2026-05-27",
        "project: Completed Work",
        "priority: low",
        "next_action: Archive project",
        "---",
        "# Completed Work",
      ].join("\n"),
      "utf8",
    );

    const result = await syncProject(wikiRoot, "review");

    expect(result.review).toEqual({
      counts: {
        idea: 0,
        active: 1,
        waiting: 0,
        blocked: 0,
        done: 1,
        archived: 0,
        unknown: 0,
      },
      blocked: [],
      noNextAction: [
        {
          path: "Active Without Action",
          title: "Active Without Action",
          status: "active",
        },
      ],
      archiveCandidates: [
        {
          path: "Completed Work",
          title: "Completed Work",
          status: "complete",
        },
      ],
    });
  });

  test("review recognizes blocked and done statuses from canonical project.md files", async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), "brain-wiki-project-statuses-"));
    const wikiRoot = join(vaultRoot, "Wiki");
    const projectRoot = join(vaultRoot, "Project");
    await mkdir(join(projectRoot, "Blocked Work"), { recursive: true });
    await mkdir(join(projectRoot, "Done Work"), { recursive: true });
    await writeFile(
      join(projectRoot, "Blocked Work", "project.md"),
      projectMarkdown({
        title: "Blocked Work",
        status: "blocked",
        next_action: "[[Resource/vendor-email]] waiting on credentials",
      }),
      "utf8",
    );
    await writeFile(
      join(projectRoot, "Done Work", "project.md"),
      projectMarkdown({
        title: "Done Work",
        status: "done",
        next_action: "",
      }),
      "utf8",
    );

    const result = await syncProject(wikiRoot, "review");

    expect(result.review?.counts).toEqual({
      active: 0,
      waiting: 0,
      blocked: 1,
      done: 1,
      archived: 0,
      idea: 0,
      unknown: 0,
    });
    expect(result.review?.blocked).toEqual([
      {
        path: "Blocked Work",
        title: "Blocked Work",
        status: "blocked",
      },
    ]);
    expect(result.review?.archiveCandidates).toEqual([
      {
        path: "Done Work",
        title: "Done Work",
        status: "done",
      },
    ]);
  });

  test("does not overwrite existing notes when CLI append fails", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      append: async (...args: unknown[]) => {
        calls.push({ method: "append", args });
        throw new Error("socket closed");
      },
      readFile: async (...args: unknown[]) => {
        calls.push({ method: "readFile", args });
        return "# Existing Notes\n";
      },
      create: async (...args: unknown[]) => {
        calls.push({ method: "create", args });
      },
    } as any;

    await expect(syncProject("/vault/Wiki", "add_note", "Project A", "new note", client))
      .rejects.toThrow("socket closed");

    expect(calls.some((call) => call.method === "create")).toBe(false);
  });

  test("rejects add_note without a client", async () => {
    await expect(syncProject("/vault/Wiki", "add_note", "Project A", "new note")).rejects.toThrow(
      "Obsidian client required",
    );
  });

  test("rejects suggest_task without a client", async () => {
    await expect(syncProject("/vault/Wiki", "suggest_task", undefined, "new task")).rejects.toThrow(
      "Obsidian client required",
    );
  });

  test("set_status updates project.md and appends a timeline entry", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async (path: string) => {
        if (path.endsWith("project.md")) {
          return `---
type: project
title: Launch Atlas
status: active
created: 2026-06-18
updated: 2026-06-18
area: [[Area/Product]]
priority: high
deadline:
next_action: [[Project/w25-Launch Atlas/notes#Kickoff]]
review_after:
resources:
  - [[Resource/PRD]]
related_projects: []
tags:
  - project
---
`;
        }
        return "# Launch Atlas Timeline\n";
      },
      write: async (_path: string, content: string) => { writes.push(content); },
      create: async (_path: string, content: string) => { writes.push(content); },
      append: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const result = await syncProject("/vault/Wiki", "set_status", "w25-Launch Atlas", JSON.stringify({
      status: "blocked",
      reason: "[[Resource/vendor-email]] waiting on credentials",
    }), client);

    expect(result.projectUpdated).toBe(true);
    expect(writes[0]).toContain("status: blocked");
    expect(writes[1]).toContain("status_change");
    expect(writes[1]).toContain("[[Resource/vendor-email]]");
  });

  test("set_status rejects invalid statuses", async () => {
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => projectMarkdown(),
      create: async () => undefined,
      append: async () => undefined,
    } as any;

    await expect(
      syncProject(
        "/vault/Wiki",
        "set_status",
        "w25-Launch Atlas",
        JSON.stringify({ status: "in-review", reason: "bad enum" }),
        client,
      ),
    ).rejects.toThrow("status is invalid");
  });

  test("set_next_action updates project.md and appends a timeline entry", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async (path: string) => path.endsWith("project.md")
        ? projectMarkdown({ status: "active", next_action: "[[Project/w25-Launch Atlas/notes#Kickoff]]" })
        : "# Launch Atlas Timeline\n",
      create: async (_path: string, content: string) => { writes.push(content); },
      append: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const result = await syncProject(
      "/vault/Wiki",
      "set_next_action",
      "w25-Launch Atlas",
      JSON.stringify({ next_action: "[[Project/w25-Launch Atlas/notes#Decision]]", reason: "[[Project/w25-Launch Atlas/notes#Decision]]" }),
      client,
    );

    expect(result.projectUpdated).toBe(true);
    expect(writes[0]).toContain("next_action: '[[Project/w25-Launch Atlas/notes#Decision]]'");
    expect(writes[1]).toContain("decision");
  });

  test("set_deadline updates project.md", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => projectMarkdown({ status: "active", deadline: "" }),
      create: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const result = await syncProject(
      "/vault/Wiki",
      "set_deadline",
      "w25-Launch Atlas",
      JSON.stringify({ deadline: "2026-06-30" }),
      client,
    );

    expect(result.projectUpdated).toBe(true);
    expect(writes[0]).toContain("deadline: '2026-06-30'");
  });

  test("link_resource and relate update list-style frontmatter fields", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => projectMarkdown(),
      create: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const resourceResult = await syncProject(
      "/vault/Wiki",
      "link_resource",
      "w25-Launch Atlas",
      JSON.stringify({ resource: "[[Resource/Launch Brief]]" }),
      client,
    );
    const relateResult = await syncProject(
      "/vault/Wiki",
      "relate",
      "w25-Launch Atlas",
      JSON.stringify({ project_link: "[[Project/w23-Shared Service/project]]" }),
      client,
    );

    expect(resourceResult.projectUpdated).toBe(true);
    expect(relateResult.projectUpdated).toBe(true);
    expect(writes[0]).toContain("[[Resource/Launch Brief]]");
    expect(writes[1]).toContain("[[Project/w23-Shared Service/project]]");
  });

  test("project mutations keep Obsidian links as scalar or flat list values", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => projectMarkdown({ status: "active" }),
      create: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    await syncProject(
      "/vault/Wiki",
      "link_resource",
      "w25-Launch Atlas",
      JSON.stringify({ resource: "[[Resource/Launch Brief]]" }),
      client,
    );

    expect(writes[0]).toContain("area: '[[Area/Product]]'");
    expect(writes[0]).toContain("- '[[Resource/PRD]]'");
    expect(writes[0]).toContain("- '[[Resource/Launch Brief]]'");
    expect(writes[0]).not.toContain("- - Area/Product");
  });

  test("timeline_append adds typed timeline entries", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      append: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const result = await syncProject(
      "/vault/Wiki",
      "timeline_append",
      "w25-Launch Atlas",
      JSON.stringify({ type: "milestone", summary: "Reached private beta", links: ["[[Resource/Beta Notes]]"] }),
      client,
    );

    expect(result.projectUpdated).toBe(true);
    expect(writes[0]).toContain("milestone");
    expect(writes[0]).toContain("[[Resource/Beta Notes]]");
  });

  test("task_add appends a structured task block", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => "# Launch Atlas Tasks\n\n## Open\n",
      create: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const result = await syncProject("/vault/Wiki", "task_add", "w25-Launch Atlas", JSON.stringify({
      summary: "Draft launch checklist",
      priority: "high",
      links: ["[[Project/w25-Launch Atlas/project]]", "[[Resource/Launch Brief]]"],
    }), client);

    expect(result.taskUpdated).toBe(true);
    expect(writes[0]).toContain("### TASK-001");
    expect(writes[0]).toContain("- status: open");
    expect(writes[0]).toContain("- summary: Draft launch checklist");
  });

  test("task_add allocates the next available task id", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => "# Launch Atlas Tasks\n\n## Open\n\n### TASK-001\n- status: open\n- priority: medium\n- created: 2026-06-18\n- depends_on: []\n- links: []\n- summary: Existing task\n",
      create: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    await syncProject(
      "/vault/Wiki",
      "task_add",
      "w25-Launch Atlas",
      JSON.stringify({ summary: "Second task" }),
      client,
    );

    expect(writes[0]).toContain("### TASK-002");
  });

  test("task_update, task_block, and task_close mutate existing tasks by id", async () => {
    const writes: string[] = [];
    const baseTasks = "# Launch Atlas Tasks\n\n## Open\n\n### TASK-001\n- status: open\n- priority: medium\n- created: 2026-06-18\n- depends_on: []\n- links: []\n- summary: Existing task\n";
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async () => baseTasks,
      create: async (_path: string, content: string) => { writes.push(content); },
      append: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    await syncProject("/vault/Wiki", "task_update", "w25-Launch Atlas", JSON.stringify({ id: "TASK-001", summary: "Updated task" }), client);
    await syncProject("/vault/Wiki", "task_block", "w25-Launch Atlas", JSON.stringify({ id: "TASK-001", reason: "[[Resource/vendor-email]]" }), client);
    await syncProject("/vault/Wiki", "task_close", "w25-Launch Atlas", JSON.stringify({ id: "TASK-001" }), client);

    expect(writes[0]).toContain("- summary: Updated task");
    expect(writes[1]).toContain("- status: blocked");
    expect(writes[2]).toContain("- status: done");
  });

  test("task_promote only promotes qualifying tasks to LIST.md", async () => {
    const writes: string[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      readFile: async (path: string) => {
        if (path.endsWith("tasks.md")) {
          return "# Launch Atlas Tasks\n\n## Open\n\n### TASK-001\n- status: open\n- priority: high\n- created: 2026-06-18\n- depends_on: []\n- links: []\n- summary: Existing task\n";
        }
        return "**2026-06-18**\n";
      },
      create: async (_path: string, content: string) => { writes.push(content); },
      append: async (_path: string, content: string) => { writes.push(content); },
    } as any;

    const promoted = await syncProject(
      "/vault/Wiki",
      "task_promote",
      "w25-Launch Atlas",
      JSON.stringify({ id: "TASK-001", crossProject: true }),
      client,
    );

    await expect(
      syncProject(
        "/vault/Wiki",
        "task_promote",
        "w25-Launch Atlas",
        JSON.stringify({ id: "TASK-001" }),
        client,
      ),
    ).rejects.toThrow("task does not meet promotion criteria");

    expect(promoted.taskSuggested).toBe(true);
    expect(writes.some((content) => content.includes("Suggested task: Existing task"))).toBe(true);
  });
});
