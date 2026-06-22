import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { analyzeExternalRepoAccess, formatExternalRepoAccessBlock } from "./context-guards.ts";

async function createWikiWithExternalRepo(): Promise<{
  wikiRoot: string;
  repoPath: string;
}> {
  const wikiRoot = await mkdtemp(join(tmpdir(), "wiki-guard-"));
  const repoPath = await mkdtemp(join(tmpdir(), "external-repo-"));

  await mkdir(join(wikiRoot, ".wiki"), { recursive: true });
  await writeFile(
    join(wikiRoot, ".wiki", "config.json"),
    JSON.stringify({
      contexts: {
        "test-context": {
          label: "Test Context",
          repo_key: "test-repo",
        },
      },
    }),
  );
  await writeFile(
    join(wikiRoot, ".wiki", "env.local.json"),
    JSON.stringify({
      repos: {
        "test-repo": repoPath,
      },
    }),
  );

  return { wikiRoot, repoPath };
}

describe("analyzeExternalRepoAccess", () => {
  test("blocks read access to configured external repo paths", async () => {
    const { wikiRoot, repoPath } = await createWikiWithExternalRepo();
    const block = await analyzeExternalRepoAccess(wikiRoot, "read", {
      path: join(repoPath, "src", "index.ts"),
    });

    expect(block).not.toBeNull();
    expect(block?.contextId).toBe("test-context");
    expect(block?.toolName).toBe("read");
    expect(formatExternalRepoAccessBlock(block!)).toContain("wiki_context_gather");
  });

  test("allows read access outside configured external repos", async () => {
    const { wikiRoot } = await createWikiWithExternalRepo();
    const block = await analyzeExternalRepoAccess(wikiRoot, "read", {
      path: join(wikiRoot, "notes", "example.md"),
    });

    expect(block).toBeNull();
  });
});
