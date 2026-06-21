import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDefaultConfig,
  loadConfig,
  loadLocalEnvConfig,
  writeDefaultConfig,
} from "./config.ts";
import { bootstrapVault } from "./scaffold.ts";

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

  test("loadLocalEnvConfig throws when env file contains malformed json", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-env-invalid-"));
    await mkdir(join(root, ".wiki"), { recursive: true });
    await writeFile(join(root, ".wiki", "env.local.json"), "{not-json", "utf8");

    await expect(loadLocalEnvConfig(root)).rejects.toThrow();
  });

  test("loadConfig drops malformed contexts and normalizes optional fields", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-contexts-"));
    await writeDefaultConfig(root, "Test Wiki");
    const configPath = join(root, ".wiki", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.contexts = {
      valid: {
        label: "Valid Context",
        pkb_note: "Area/Work/Valid.md",
        repo_key: "valid_repo",
        allowed_intents: ["overview", "question", "bad-intent", 42],
        seed_files: ["README.md", 7, null],
        include_paths: ["src", false],
        exclude_paths: ["dist", {}],
        search_terms: ["pi", 9],
        notes: "use for questions",
      },
      missingRequired: {
        label: "Missing Required",
        allowed_intents: ["overview"],
      },
      wrongShape: "not-an-object",
    };
    await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const loaded = await loadConfig(root);
    expect(loaded.contexts).toEqual({
      valid: {
        label: "Valid Context",
        pkb_note: "Area/Work/Valid.md",
        repo_key: "valid_repo",
        allowed_intents: ["overview", "question"],
        seed_files: ["README.md"],
        include_paths: ["src"],
        exclude_paths: ["dist"],
        search_terms: ["pi"],
        notes: "use for questions",
      },
    });
  });

  test("bootstrapVault creates the local env example file", async () => {
    const root = await mkdtemp(join(tmpdir(), "brain-wiki-bootstrap-"));

    await bootstrapVault(root, "Test Wiki");

    const content = JSON.parse(await readFile(join(root, ".wiki", "env.local.example.json"), "utf8"));
    expect(content).toEqual({
      repos: {
        example_repo_key: "/absolute/path/to/local/repo",
      },
    });
  });
});
