import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig } from "./config.ts";
import { captureSource } from "./capture.ts";
import { sourcePacketDir } from "./paths.ts";

function summaryTemplate(): string {
  return [
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
  ].join("\n");
}

describe("captureSource packet flow", () => {
  test("writes packet artifacts without going through Obsidian create", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-capture-"));
    const config = createDefaultConfig("Wiki");
    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(join(root, "inbox"), { recursive: true });
    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(join(root, ".wiki", "templates", "summary.md"), summaryTemplate(), "utf8");

    const createCalls: string[] = [];
    const client = {
      search: async () => [],
      properties: async () => ({ title: "Agent", summary: "", aliases: [], tags: [], source_ids: [] }),
      backlinks: async () => [],
      links: async () => [],
      create: async (path: string) => {
        createCalls.push(path);
        if (path.includes("inbox/")) {
          throw new Error(`packet write should not use Obsidian create: ${path}`);
        }
      },
      config: { socketPath: "", vaultCwd: root, timeout: 0 },
    } as any;

    const result = await captureSource(
      root,
      root,
      config,
      {
        inputType: "text",
        value: "# Agent\n\nCapture flow test",
        title: "Agent",
        createSourcePage: true,
      },
      {
        exec: async () => ({ stdout: "", stderr: "", code: 0 }),
      },
      undefined,
      client,
    );

    expect(createCalls.some((path) => path.includes("inbox/"))).toBe(false);
    expect(createCalls.some((path) => path.includes("pages/summaries/"))).toBe(true);
    expect(await readFile(join(root, result.packetDir, "capture.state.json"), "utf8")).toContain('"status": "integration_pending"');
    expect(await readFile(join(root, result.packetDir, "manifest.json"), "utf8")).toContain('"status": "captured"');
    expect(await readFile(join(root, result.packetDir, "extracted.md"), "utf8")).toContain("Capture flow test");
  });

  test("reuses an incomplete packet when retrying the same source", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-capture-"));
    const config = createDefaultConfig("Wiki");
    const stamp = new Date().toISOString().slice(0, 10);
    const sourceId = `SRC-${stamp}-001`;
    const packetDir = sourcePacketDir(root, sourceId);

    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(packetDir, { recursive: true });
    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(join(root, ".wiki", "templates", "summary.md"), summaryTemplate(), "utf8");
    await writeFile(
      join(packetDir, "capture.state.json"),
      `${JSON.stringify(
        {
          version: 1,
          sourceId,
          status: "failed",
          origin: { type: "text", value: "# Agent\n\nCapture flow test" },
          capturedAt: `${stamp}T00:00:00.000Z`,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const client = {
      search: async () => [],
      properties: async () => ({ title: "Agent", summary: "", aliases: [], tags: [], source_ids: [] }),
      backlinks: async () => [],
      links: async () => [],
      create: async () => {},
      config: { socketPath: "", vaultCwd: root, timeout: 0 },
    } as any;

    const result = await captureSource(
      root,
      root,
      config,
      {
        inputType: "text",
        value: "# Agent\n\nCapture flow test",
        title: "Agent",
        createSourcePage: true,
      },
      {
        exec: async () => ({ stdout: "", stderr: "", code: 0 }),
      },
      undefined,
      client,
    );

    expect(result.sourceId).toBe(sourceId);
    expect(await readFile(join(packetDir, "capture.state.json"), "utf8")).toContain('"status": "integration_pending"');
  });
});
