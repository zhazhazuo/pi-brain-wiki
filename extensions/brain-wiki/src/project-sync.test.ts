import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectTemplate, validateProjectFrontmatter } from "./project-schema.ts";
import { formatProjectTitleForWeek, syncProject } from "./project-sync.ts";

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
        active: 1,
        waiting: 0,
        complete: 1,
        archived: 0,
        unknown: 0,
      },
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
});
