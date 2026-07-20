import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig } from "./config.ts";
import { integrateCapturedSource } from "./integration.ts";
import { listCaptureStates } from "./capture.ts";
import { buildStatus } from "../index.ts";

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

describe("capture state", () => {
  test("lists integration-pending packets", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-state-"));
    const config = createDefaultConfig("Wiki");
    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(join(root, "inbox", "SRC-2026-06-16-001"), { recursive: true });
    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(join(root, ".wiki", "templates", "summary.md"), summaryTemplate(), "utf8");
    await writeFile(
      join(root, "inbox", "SRC-2026-06-16-001", "capture.state.json"),
      [
        "{",
        '  "version": 1,',
        '  "sourceId": "SRC-2026-06-16-001",',
        '  "status": "integration_pending",',
        '  "origin": { "type": "url", "value": "https://example.com/article" },',
        '  "capturedAt": "2026-06-16T00:01:22.400Z"',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const states = await listCaptureStates(root);
    expect(states).toHaveLength(1);
    expect(states[0].status).toBe("integration_pending");
    expect(states[0].sourceId).toBe("SRC-2026-06-16-001");
  });

  test("integration updates state and status summary", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-state-"));
    const config = createDefaultConfig("Wiki");
    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(join(root, "inbox", "SRC-2026-06-16-001"), { recursive: true });
    await mkdir(join(root, "pages", "summaries"), { recursive: true });
    await mkdir(join(root, "pages", "topics"), { recursive: true });
    await mkdir(join(root, "meta"), { recursive: true });
    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(join(root, ".wiki", "templates", "summary.md"), summaryTemplate(), "utf8");
    await writeFile(
      join(root, "inbox", "SRC-2026-06-16-001", "capture.state.json"),
      [
        "{",
        '  "version": 1,',
        '  "sourceId": "SRC-2026-06-16-001",',
        '  "status": "integration_pending",',
        '  "origin": { "type": "url", "value": "https://example.com/article" },',
        '  "capturedAt": "2026-06-16T00:01:22.400Z",',
        '  "sourcePagePath": "pages/summaries/2026-06-16-example.md"',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "inbox", "SRC-2026-06-16-001", "manifest.json"),
      [
        "{",
        '  "version": 1,',
        '  "sourceId": "SRC-2026-06-16-001",',
        '  "title": "Example",',
        '  "kind": "article",',
        '  "origin": { "type": "url", "value": "https://example.com/article" },',
        '  "capturedAt": "2026-06-16T00:01:22.400Z",',
        '  "mimeType": "text/html",',
        '  "hash": "sha256:abc",',
        '  "originalFiles": [],',
        '  "extracted": { "path": "extracted.md", "converter": "fetch-fallback", "sha256": "def" },',
        '  "attachments": [],',
        '  "status": "captured"',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "pages", "summaries", "2026-06-16-example.md"),
      [
        "---",
        "id: SRC-2026-06-16-001",
        "type: summary",
        "title: Example",
        "kind: article",
        "status: captured",
        "captured_at: 2026-06-16T00:01:22.400Z",
        "integrated_at:",
        "origin_type: url",
        "origin_value: https://example.com/article",
        "manifest_path: inbox/SRC-2026-06-16-001/manifest.json",
        "raw_path: inbox/SRC-2026-06-16-001/extracted.md",
        "aliases: []",
        "tags: []",
        "source_ids:",
        "  - SRC-2026-06-16-001",
        "summary: Example summary",
        "edges:",
        "  - id: edge-1",
        "    text: How does the example model handle conflicts?",
        "    state: open",
        "---",
        "",
        "# Example",
        "",
        "## Bridge",
        "",
        "**What you already know:** basics",
        "**What is genuinely new:** the example model",
        "**Where the edge is:** conflict handling",
        "",
        "## Integration targets",
        "- [[topics/example]] — adds the example model",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "pages", "topics", "example.md"),
      [
        "---",
        "id: topic-example",
        "type: topic",
        "title: Example",
        "status: draft",
        "updated: 2026-06-16",
        "source_ids: []",
        "summary: Example topic",
        "---",
        "",
        "# Example",
      ].join("\n"),
      "utf8",
    );

    await integrateCapturedSource(root, "SRC-2026-06-16-001", {
      pagePaths: ["pages/topics/example.md"],
    });

    const stateText = await readFile(join(root, "inbox", "SRC-2026-06-16-001", "capture.state.json"), "utf8");
    expect(stateText).toContain('"status": "integrated"');

    const status = await buildStatus(root);
    expect(status.sources.pendingIntegration).toBe(0);
    expect(status.sources.integrated).toBe(1);
  });
});
