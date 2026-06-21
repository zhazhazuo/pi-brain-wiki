import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDefaultConfig,
  loadConfig,
  loadLocalEnvConfig,
  writeDefaultConfig,
} from "./config.ts";

describe("external context config", () => {
  test("default config starts with empty context registry", () => {
    const config = createDefaultConfig("Test Wiki");
    expect(config.contexts).toEqual({});
  });

  test("loadConfig merges configured contexts", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-config-"));
    await writeDefaultConfig(root, "Test Wiki");
    const configPath = join(root, ".wiki", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.contexts = {
      "sales-tool-application": {
        label: "Sales Tool Application",
        pkb_note: "Area/5 Work/53 Visable/Sales Tool Application.md",
        repo_key: "sales_tool_application_repo",
        allowed_intents: ["overview", "architecture"],
      },
    };
    await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const loaded = await loadConfig(root);
    expect(loaded.contexts["sales-tool-application"]?.repo_key).toBe("sales_tool_application_repo");
  });

  test("loadLocalEnvConfig returns empty repos when env file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-env-"));
    const env = await loadLocalEnvConfig(root);
    expect(env.repos).toEqual({});
  });
});
