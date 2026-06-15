import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatProjectTitleForWeek, syncProject } from "./project-sync.ts";

describe("syncProject Obsidian IO", () => {
  test("formats project titles with a zero-padded ISO week prefix", () => {
    expect(formatProjectTitleForWeek("Project Title", new Date("2026-01-14T12:00:00Z"))).toBe("w03-Project Title");
  });

  test("creates a project directory and same-named markdown file with the weekly title", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const weeklyTitle = formatProjectTitleForWeek("Project Title");
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      create: async (...args: unknown[]) => {
        calls.push({ method: "create", args });
      },
    } as any;

    const result = await syncProject("/vault/Wiki", "create_project", "Project Title", undefined, client);

    expect(result.projectCreated).toBe(true);
    expect(result.projectPath).toBe(`Project/${weeklyTitle}/${weeklyTitle}.md`);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(`Project/${weeklyTitle}/${weeklyTitle}.md`);
    expect(String(calls[0].args[1])).toContain(`title: ${weeklyTitle}`);
    expect(String(calls[0].args[1])).toContain(`type: project`);
    expect(String(calls[0].args[1])).toContain(`project: Project Title`);
    expect(String(calls[0].args[1])).toContain(`next_action:`);
    expect(String(calls[0].args[1])).toContain(`# ${weeklyTitle}`);
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
});
