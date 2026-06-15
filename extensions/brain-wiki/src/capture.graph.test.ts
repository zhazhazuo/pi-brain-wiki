import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig } from "./config.ts";
import { captureSource } from "./capture.ts";

describe("captureSource graph context", () => {
  test("seeds the summary page with PKB context when related notes exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-capture-"));
    const config = createDefaultConfig("Wiki");
    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(join(root, "inbox"), { recursive: true });
    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(
      join(root, ".wiki", "templates", "summary.md"),
      [
        "---",
        "id: {{id}}",
        "type: summary",
        "title: {{title}}",
        "kind: {{kind}}",
        "status: captured",
        "captured_at: {{captured_at}}",
        "integrated_at:",
        "origin_type: {{origin_type}}",
        "origin_value: {{origin_value}}",
        "manifest_path: {{manifest_path}}",
        "raw_path: {{raw_path}}",
        "aliases: []",
        "tags: []",
        "source_ids:",
        "  - {{id}}",
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

    const result = await captureSource(
      root,
      root,
      config,
      {
        inputType: "text",
        value: "# Agent\n\nGraph-native agent notes",
        title: "Agent",
        createSourcePage: true,
      },
      {
        exec: async () => ({ stdout: "", stderr: "", code: 0 }),
      },
      undefined,
      client,
    );

    expect(result.sourcePagePath).toContain("pages/summaries");
    expect(calls.some((call) => String(call.args[1]).includes("## PKB Context"))).toBe(true);
    expect(calls.some((call) => String(call.args[1]).includes("Agent PKB"))).toBe(true);
  });
});
