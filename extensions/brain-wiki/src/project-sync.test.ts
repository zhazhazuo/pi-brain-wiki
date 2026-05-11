import { describe, expect, test } from "bun:test";
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
    expect(String(calls[0].args[1])).toContain(`# ${weeklyTitle}`);
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
});
