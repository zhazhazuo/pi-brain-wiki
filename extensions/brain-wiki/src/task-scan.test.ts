import { describe, expect, test } from "bun:test";
import { scanListMdItems, scanVaultForTasks } from "./task-scan.ts";
import type { RegistryData } from "./types.ts";

describe("scanListMdItems", () => {
  test("finds stale unprocessed items", () => {
    const content = `
**2026-05-20**
- [ ] https://example.com/blog about types
- [x] Done item

**2026-06-09**
- [ ] Research voice recording
`;
    const items = scanListMdItems(content, "2026-06-10");
    expect(items.length).toBe(1);
    expect(items[0].source).toContain("LIST.md");
    expect(items[0].reason).toContain("21 days");
  });

  test("ignores recent items", () => {
    const content = `**2026-06-09**\n- [ ] Recent item`;
    const items = scanListMdItems(content, "2026-06-10");
    expect(items.length).toBe(0);
  });
});

describe("scanVaultForTasks", () => {
  test("returns empty array when nothing to scan", async () => {
    const registry: RegistryData = { version: 1, generatedAt: "2026-06-01T00:00:00Z", pages: [] };
    const result = await scanVaultForTasks("/nonexistent", registry, { scope: "list_md", since: "2026-06-01" });
    expect(result).toHaveLength(0);
  });
});
