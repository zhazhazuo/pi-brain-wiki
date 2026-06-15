import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig } from "./config.ts";
import { buildRegistry } from "./indexer.ts";
import { scanWikiPages } from "./indexer.ts";
import { syncParaToWiki } from "./sync.ts";

describe("syncParaToWiki", () => {
  test("deduplicates same-named PARA folders within one run", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "brain-wiki-sync-"));
    const root = join(sandbox, "vault", "Wiki");
    const config = createDefaultConfig("Wiki");

    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(join(root, "pages", "topics"), { recursive: true });
    await mkdir(join(root, "meta"), { recursive: true });
    await mkdir(join(root, "..", "Area", "AI"), { recursive: true });
    await mkdir(join(root, "..", "Resource", "AI"), { recursive: true });

    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(
      join(root, ".wiki", "templates", "topic.md"),
      [
        "---",
        "id: {{id}}",
        "type: topic",
        "title: {{title}}",
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

    const emptyRegistry = buildRegistry([]);
    const result = await syncParaToWiki(root, config, emptyRegistry, "all");

    expect(result.topicsCreated).toBe(1);
    expect(result.topicsUpdated).toBe(1);
    expect(result.pages.filter((path) => path === "pages/topics/ai.md")).toHaveLength(2);

    const raw = await readFile(join(root, "pages", "topics", "ai.md"), "utf8");
    expect(raw).toContain("para_sources:");
    expect(raw).toContain("- Area/AI");
    expect(raw).toContain("- Resource/AI");
  });

  test("writes sync-state with touched pages", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "brain-wiki-sync-"));
    const root = join(sandbox, "vault", "Wiki");
    const config = createDefaultConfig("Wiki");

    await mkdir(join(root, ".wiki", "templates"), { recursive: true });
    await mkdir(join(root, "pages", "topics"), { recursive: true });
    await mkdir(join(root, "meta"), { recursive: true });
    await mkdir(join(root, "..", "Area", "Agents"), { recursive: true });

    await writeFile(join(root, ".wiki", "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await writeFile(
      join(root, ".wiki", "templates", "topic.md"),
      [
        "---",
        "id: {{id}}",
        "type: topic",
        "title: {{title}}",
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

    const result = await syncParaToWiki(root, config, buildRegistry([]), "area");
    expect(result.pages).toEqual(["pages/topics/agents.md"]);

    const syncState = await readFile(join(root, "meta", "sync-state.json"), "utf8");
    expect(syncState).toContain('"scope": "area"');
    expect(syncState).toContain('"pages"');
    expect(syncState).toContain('"pages/topics/agents.md"');
  });
});
