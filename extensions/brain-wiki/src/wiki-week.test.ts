import { describe, expect, test } from "bun:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderWeekMd, buildWeekMdData, writeWeekMd } from "./wiki-week.ts";
import type { TaskExportRecord } from "./types.ts";

describe("buildWeekMdData", () => {
  test("categorizes tasks into correct sections", () => {
    const now = new Date("2024-06-15T12:00:00Z"); // Saturday
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString();
    const records: TaskExportRecord[] = [
      { id: 1, uuid: "a", description: "Overdue task", status: "pending", priority: "H", urgency: 10, due: yesterday },
      { id: 2, uuid: "b", description: "Active task", status: "pending", priority: "M", urgency: 5, start: now.toISOString() },
      { id: 3, uuid: "c", description: "This week task", status: "pending", priority: "L", urgency: 3, scheduled: now.toISOString() },
      { id: 4, uuid: "d", description: "Blocked task", status: "pending", priority: "H", urgency: 8, depends: ["e"] },
      { id: 5, uuid: "e", description: "Done task", status: "completed", priority: "M", urgency: 5, end: now.toISOString() },
      { id: 6, uuid: "f", description: "Recurring task", status: "recurring", priority: "L", urgency: 2, rtype: "weekly" },
    ];
    const data = buildWeekMdData(records, now);
    const findRows = (heading: string) => data.sections.find((s) => s.heading.includes(heading))?.rows ?? [];
    expect(findRows("Overdue").some((r) => r.Task === "Overdue task")).toBe(true);
    expect(findRows("Active").some((r) => r.Task === "Active task")).toBe(true);
    expect(findRows("This Week").some((r) => r.Task === "This week task")).toBe(true);
    expect(findRows("Blocked").some((r) => r.Task === "Blocked task")).toBe(true);
    expect(findRows("Done This Week").some((r) => r.Task === "Done task")).toBe(true);
    expect(findRows("Recurring").some((r) => r.Task === "Recurring task")).toBe(true);
  });

  test("returns exactly 8 sections with correct headings", () => {
    const data = buildWeekMdData([], new Date());
    expect(data.sections.length).toBe(8);
    expect(data.sections.map((s) => s.heading)).toEqual([
      "## 🔴 Overdue",
      "## 🟡 Active (started)",
      "## 🔵 This Week",
      "## 🔗 Blocked",
      "## 🔒 Blocking",
      "## 🔁 Recurring",
      "## ✅ Done This Week",
      "## ⚪ Backlog",
    ]);
  });

  test("handles empty records", () => {
    const data = buildWeekMdData([], new Date());
    expect(data.sections.every((s) => s.rows.length === 0)).toBe(true);
  });
});

describe("renderWeekMd", () => {
  test("generates markdown with sections", () => {
    const now = new Date();
    const records: TaskExportRecord[] = [
      { id: 1, uuid: "a", description: "BUG: Fix login", status: "pending", priority: "H", urgency: 10, due: now.toISOString(), scheduled: now.toISOString(), project: "Techno.Login-Fix", tags: ["BUG"] },
    ];
    const md = renderWeekMd(records, now);
    expect(md).toContain("# Week");
    expect(md).toContain("BUG: Fix login");
    expect(md).toContain("Techno.Login-Fix");
    expect(md).toContain(`_Refreshed: ${now.toISOString()}_`);
  });

  test("renders markdown table structure for sections with rows", () => {
    const now = new Date();
    const records: TaskExportRecord[] = [
      { id: 1, uuid: "a", description: "BUG: Fix login", status: "pending", priority: "H", urgency: 10, due: now.toISOString(), scheduled: now.toISOString(), project: "Techno.Login-Fix", tags: ["BUG"] },
    ];
    const md = renderWeekMd(records, now);
    expect(md).toContain("| # | Task | Project | Estimate | Pri | Sch | Due |");
    expect(md).toContain("| --- | --- | --- | --- | --- | --- | --- |");
  });

  test("renders *No tasks* for empty sections", () => {
    const now = new Date();
    const md = renderWeekMd([], now);
    const noTaskCount = md.split("*No tasks*").length - 1;
    expect(noTaskCount).toBe(8);
  });
});

describe("writeWeekMd", () => {
  test("writes text to WEEK.md in vault root and returns path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "wiki-week-test-"));
    try {
      const path = await writeWeekMd(tempDir, "test content");
      expect(path).toBe(join(tempDir, "WEEK.md"));
      const content = await readFile(path, "utf8");
      expect(content).toBe("test content\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
