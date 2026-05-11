import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "bun:test";
import { appendEvent } from "./log.ts";

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
