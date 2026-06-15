import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findListItem, markListItemPromoted, markListItemDone, getTasksWithListSource, syncCompletedTasksToList } from "./task-sync.ts";
import type { TaskExportRecord } from "./types.ts";

const sampleList = `
**2026-06-01**
- [ ] First item
- [ ] Second item
- [x] Done item

**2026-06-02**
- [ ] Third item
- [>] Promoted item
`;

// Helper: create a mock vault so listMdPath resolves correctly.
async function setupVault(root: string, listContent: string) {
  const vaultPath = `${root}/vault`;
  const wikiPath = `${vaultPath}/Wiki`;
  const listPath = `${vaultPath}/LIST.md`;
  await Bun.write(`${wikiPath}/.wiki/config.json`, "{}");
  await Bun.write(listPath, listContent);
  return { vaultPath, wikiPath, listPath };
}

function makeClient(vaultCwd: string) {
  return {
    config: { socketPath: "", vaultCwd, timeout: 0 },
    readFile: async (path: string) => readFile(join(vaultCwd, path), "utf8"),
    create: async (path: string, content: string) => {
      await writeFile(join(vaultCwd, path), content, "utf8");
    },
  } as any;
}

describe("findListItem", () => {
  test("finds item by date and index", () => {
    const item = findListItem(sampleList, "2026-06-01", 2);
    expect(item).not.toBeNull();
    expect(item!.line).toContain("Second item");
  });

  test("returns null for missing date", () => {
    const item = findListItem(sampleList, "2026-06-03", 1);
    expect(item).toBeNull();
  });

  test("returns null for missing index", () => {
    const item = findListItem(sampleList, "2026-06-01", 99);
    expect(item).toBeNull();
  });
});

describe("markListItemPromoted", () => {
  test("changes [ ] to [>]", async () => {
    const { vaultPath, wikiPath, listPath } = await setupVault("/tmp/test-promoted", `**2026-06-01**\n- [ ] First item\n- [ ] Second item`);
    await markListItemPromoted(wikiPath, "2026-06-01", 1, makeClient(vaultPath));
    const updated = await Bun.file(listPath).text();
    expect(updated).toContain("- [>] First item");
    expect(updated).toContain("- [ ] Second item");
  });

  test("rejects when no client is available", async () => {
    const { wikiPath } = await setupVault("/tmp/test-promoted-reject", `**2026-06-01**\n- [ ] First item`);
    await expect(markListItemPromoted(wikiPath, "2026-06-01", 1, null)).rejects.toThrow("Obsidian client required");
  });
});

describe("markListItemDone", () => {
  test("changes [ ] to [x]", async () => {
    const { vaultPath, wikiPath, listPath } = await setupVault("/tmp/test-done", `**2026-06-01**\n- [ ] First item\n- [ ] Second item`);
    await markListItemDone(wikiPath, "2026-06-01", 1, makeClient(vaultPath));
    const updated = await Bun.file(listPath).text();
    expect(updated).toContain("- [x] First item");
    expect(updated).toContain("- [ ] Second item");
  });

  test("changes [>] to [x]", async () => {
    const { vaultPath, wikiPath, listPath } = await setupVault("/tmp/test-done2", `**2026-06-01**\n- [>] Promoted item`);
    await markListItemDone(wikiPath, "2026-06-01", 1, makeClient(vaultPath));
    const updated = await Bun.file(listPath).text();
    expect(updated).toContain("- [x] Promoted item");
  });

  test("rejects when no client is available", async () => {
    const { wikiPath } = await setupVault("/tmp/test-done-reject", `**2026-06-01**\n- [ ] First item`);
    await expect(markListItemDone(wikiPath, "2026-06-01", 1, null)).rejects.toThrow("Obsidian client required");
  });
});

describe("getTasksWithListSource", () => {
  test("extracts tasks with source annotations", async () => {
    const mockTasks: TaskExportRecord[] = [
      {
        id: 1,
        uuid: "a1",
        description: "Task one",
        status: "pending",
        urgency: 1,
        annotations: [
          { entry: "2026-06-01", description: "source: LIST.md:2026-06-01:item-1" },
        ],
      },
      {
        id: 2,
        uuid: "a2",
        description: "Task two",
        status: "pending",
        urgency: 1,
      },
    ];
    const runner = {
      exec: async () => ({ stdout: JSON.stringify(mockTasks), stderr: "", code: 0 }),
    };
    const tasks = await getTasksWithListSource(runner as any);
    expect(tasks.length).toBe(2);
    expect(tasks[0].source).toBe("LIST.md:2026-06-01:item-1");
    expect(tasks[1].source).toBeUndefined();
  });
});

describe("syncCompletedTasksToList", () => {
  test("marks completed LIST.md tasks as done", async () => {
    const { vaultPath, wikiPath, listPath } = await setupVault("/tmp/test-sync", `**2026-06-01**\n- [ ] First item\n- [ ] Second item`);

    const mockTasks: TaskExportRecord[] = [
      {
        id: 1,
        uuid: "a1",
        description: "Task one",
        status: "completed",
        urgency: 1,
        annotations: [
          { entry: "2026-06-01", description: "source: LIST.md:2026-06-01:item-1" },
        ],
      },
    ];
    const runner = {
      exec: async () => ({ stdout: JSON.stringify(mockTasks), stderr: "", code: 0 }),
    };
    const result = await syncCompletedTasksToList(wikiPath, runner as any, makeClient(vaultPath));
    expect(result.markedDone).toBe(1);
    expect(result.errors).toHaveLength(0);

    const updated = await Bun.file(listPath).text();
    expect(updated).toContain("- [x] First item");
    expect(updated).toContain("- [ ] Second item");
  });

  test("ignores completed tasks without source annotation", async () => {
    const { listPath } = await setupVault("/tmp/test-sync2", `**2026-06-01**\n- [ ] First item`);

    const mockTasks: TaskExportRecord[] = [
      {
        id: 1,
        uuid: "a1",
        description: "Task one",
        status: "completed",
        urgency: 1,
      },
    ];
    const runner = {
      exec: async () => ({ stdout: JSON.stringify(mockTasks), stderr: "", code: 0 }),
    };
    const result = await syncCompletedTasksToList("/tmp/test-sync2/vault/Wiki", runner as any, null);
    expect(result.markedDone).toBe(0);

    const updated = await Bun.file(listPath).text();
    expect(updated).toContain("- [ ] First item");
  });
});
