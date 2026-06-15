import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import { appendEvent, markSourcesIntegrated } from "./log.ts";

let tempRoot: string | undefined;

describe("appendEvent", () => {
  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  });

  test("keeps generated event metadata filesystem-backed even when a client is present", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "brain-wiki-log-"));
    const calls: unknown[] = [];
    const client = {
      config: { socketPath: "", vaultCwd: tempRoot, timeout: 0 },
      append: async (...args: unknown[]) => {
        calls.push(args);
      },
    } as any;

    await appendEvent(tempRoot, { ts: "2026-05-11T00:00:00.000Z", kind: "query", title: "First" } as any, client);
    await appendEvent(tempRoot, { ts: "2026-05-11T00:01:00.000Z", kind: "query", title: "Second" } as any, client);

    expect(calls).toEqual([]);
    const raw = await readFile(join(tempRoot, "meta", "events.jsonl"), "utf8");
    expect(raw.split("\n").filter(Boolean)).toHaveLength(2);
    expect(() => raw.split("\n").filter(Boolean).map((line) => JSON.parse(line))).not.toThrow();
  });
});

describe("markSourcesIntegrated", () => {
  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  });

  test("skips missing manifest files when a client is present", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "brain-wiki-log-manifest-"));
    const client = {
      config: { socketPath: "", vaultCwd: tempRoot, timeout: 0 },
      readFile: async () => {
        throw new Error("Obsidian read failed for Wiki/inbox/SRC-1/manifest.json: Error: File not found");
      },
      files: async () => ["Wiki/pages/summaries/source.md"],
      create: async () => {},
      writeFile: async () => {},
    } as any;

    await markSourcesIntegrated(tempRoot, ["SRC-1"], "2026-06-15T00:00:00.000Z", client);

    const raw = await readFile(join(tempRoot, "meta", "events.jsonl"), "utf8").catch(() => "");
    expect(raw).toBe("");
  });
});
