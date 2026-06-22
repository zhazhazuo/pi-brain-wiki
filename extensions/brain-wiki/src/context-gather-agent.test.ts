import { describe, expect, test } from "bun:test";
import { buildGatherAgentTask } from "./context-gather-agent.ts";
import type { ResolvedExternalContext } from "./types.ts";

const context: ResolvedExternalContext = {
  context_id: "operation-platform",
  label: "Operation Platform",
  pkb_note: "Area/5 Work/53 Visable/Operation Platform.md",
  repo_key: "operation_platform_repo",
  repo_path: "/tmp/op",
  allowed_intents: ["overview", "architecture", "implementation", "question"],
  seed_files: ["README.md"],
  include_paths: ["src/auth"],
  exclude_paths: ["node_modules"],
  search_terms: ["auth"],
};

describe("buildGatherAgentTask", () => {
  test("includes repo-local guidance and intent", async () => {
    const task = await buildGatherAgentTask(
      context,
      "architecture",
      "How is auth wired?",
    );

    expect(task).toContain("operation-platform");
    expect(task).toContain("AGENTS.md");
    expect(task).toContain("architecture");
    expect(task).toContain("How is auth wired?");
    expect(task).toContain("src/auth");
    expect(task).toContain("Do not ask follow-up questions");
  });
});
