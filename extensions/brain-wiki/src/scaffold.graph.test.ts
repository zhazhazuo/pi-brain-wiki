import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig } from "./config.ts";
import { ensureCanonicalPage } from "./scaffold.ts";

describe("ensureCanonicalPage graph context", () => {
  test("seeds new pages with PKB context when the client can discover related notes", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-scaffold-"));
    const config = createDefaultConfig("Wiki");
    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(
      join(root, ".wiki", "templates", "topic.md"),
      [
        "---",
        "id: {{id}}",
        "type: topic",
        "title: {{title}}",
        "aliases: []",
        "tags: []",
        "status: draft",
        "updated: {{updated}}",
        "source_ids: []",
        "summary:",
        "---",
        "",
        "# {{title}}",
      ].join("\n"),
      "utf8",
    );

    const calls: Array<{ args: unknown[] }> = [];
    const client = {
      search: async () => ["Area/1 CS/17 AI/Agent.md"],
      properties: async () => ({
        title: "Agent PKB",
        summary: "Existing PKB entry",
        aliases: [],
        tags: ["RESOURCE"],
        source_ids: [],
      }),
      backlinks: async () => [],
      links: async () => [],
      create: async (...args: unknown[]) => {
        calls.push({ args });
      },
      config: { socketPath: "", vaultCwd: root, timeout: 0 },
    } as any;

    const result = await ensureCanonicalPage(
      root,
      config,
      { version: 1, generatedAt: new Date().toISOString(), pages: [] },
      {
        type: "topic",
        title: "Agent",
        summary: "Graph-native agent notes",
        createIfMissing: true,
      },
      client,
    );

    expect(result.created).toBe(true);
    expect(calls).toHaveLength(1);
    expect(String(calls[0].args[1])).toContain("## PKB Context");
    expect(String(calls[0].args[1])).toContain("Agent PKB");
  });
});
