import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLint } from "./lint.ts";
import { writeDefaultConfig } from "./config.ts";
import { ObsidianClient } from "./obsidian-client.ts";

const cleanupRoots: string[] = [];

afterAll(async () => {
  await Promise.all(
    cleanupRoots.map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function makeWikiRoot() {
  const root = await mkdtemp(join(tmpdir(), "brain-wiki-lint-"));
  cleanupRoots.push(root);
  await mkdir(join(root, "pages", "summaries"), { recursive: true });
  await mkdir(join(root, "pages", "topics"), { recursive: true });
  await mkdir(join(root, "pages", "plans"), { recursive: true });
  await mkdir(join(root, "pages", "reviews"), { recursive: true });
  await mkdir(join(root, "pages", "workflows"), { recursive: true });
  await mkdir(join(root, "meta"), { recursive: true });
  await writeDefaultConfig(root, "Test Wiki");
  return root;
}

async function writePage(root: string, relativePath: string, text: string) {
  const absolute = join(root, relativePath);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, text, "utf8");
}

describe("runLint conformance", () => {
  test("flags summary pages with empty source_ids", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-a.md",
      `---
id: SRC-1
type: summary
title: Source A
status: captured
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/a
manifest_path: inbox/a/manifest.json
raw_path: inbox/a/raw.md
source_ids: []
summary: concise
---

# Source A

## Integration targets
- [[topics/topic-a]]
`
    );

    const run = await runLint(root, "frontmatter");
    expect(run.issues.some((issue) => issue.message.includes("source_ids must be non-empty"))).toBe(true);
  });

  test("flags topic pages that reference missing summary sources", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/topics/topic-a.md",
      `---
id: topic-a
type: topic
title: Topic A
status: draft
updated: 2026-06-14
source_ids:
  - SRC-404
summary: concise
---

# Topic A
`
    );

    const run = await runLint(root, "frontmatter");
    expect(run.issues.some((issue) => issue.message.includes("source_ids must resolve to existing summary pages"))).toBe(true);
  });

  test("accepts integrated_at as a YAML date", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-date.md",
      `---
id: SRC-DATE
type: summary
title: Source Date
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/date
manifest_path: inbox/date/manifest.json
raw_path: inbox/date/raw.md
source_ids:
  - SRC-DATE
summary: concise
integrated_at: 2026-06-14T10:00:00Z
---

# Source Date
`
    );

    const run = await runLint(root, "frontmatter");
    expect(run.issues.some((issue) => issue.message.includes("integrated summary pages must set integrated_at"))).toBe(false);
  });

  test("flags integrated summaries missing integrated_at", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-b.md",
      `---
id: SRC-2
type: summary
title: Source B
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/b
manifest_path: inbox/b/manifest.json
raw_path: inbox/b/raw.md
source_ids:
  - SRC-2
summary: concise
---

# Source B
`
    );

    const run = await runLint(root, "frontmatter");
    expect(run.issues.some((issue) => issue.message.includes("integrated summary pages must set integrated_at"))).toBe(true);
  });

  test("flags integrated summaries with empty integrated_at", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-c.md",
      `---
id: SRC-3
type: summary
title: Source C
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/c
manifest_path: inbox/c/manifest.json
raw_path: inbox/c/raw.md
source_ids:
  - SRC-3
summary: concise
integrated_at:
---

# Source C
`
    );

    const run = await runLint(root, "frontmatter");
    expect(run.issues.some((issue) => issue.message.includes("integrated summary pages must set integrated_at"))).toBe(true);
  });

  test("flags consumed pages missing consumed_at or pkb_refs", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-consumed.md",
      `---
id: SRC-CONSUMED
type: summary
title: Source Consumed
status: consumed
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/consumed
manifest_path: inbox/consumed/manifest.json
raw_path: inbox/consumed/raw.md
source_ids:
  - SRC-CONSUMED
summary: concise
---

# Source Consumed
`
    );

    const run = await runLint(root, "frontmatter");
    expect(run.issues.some((issue) => issue.message.includes("Consumed page is missing consumed_at"))).toBe(true);
    expect(run.issues.some((issue) => issue.message.includes("Consumed page is missing pkb_refs"))).toBe(true);
  });

  test("flags invalid status values for each page type", async () => {
    const invalidByType: Record<string, { frontmatter: Record<string, unknown>; path: string }> = {
      summary: {
        path: "pages/summaries/source-a.md",
        frontmatter: {
          id: "SRC-1",
          type: "summary",
          title: "Source A",
          status: "active", // invalid for summary
          captured_at: "2026-06-14",
          origin_type: "url",
          origin_value: "https://example.com/a",
          manifest_path: "inbox/a/manifest.json",
          raw_path: "inbox/a/raw.md",
          source_ids: ["SRC-1"],
          summary: "concise",
        },
      },
      topic: {
        path: "pages/topics/topic-a.md",
        frontmatter: {
          id: "topic-a",
          type: "topic",
          title: "Topic A",
          status: "active", // invalid for topic
          updated: "2026-06-14",
          source_ids: [],
          summary: "concise",
        },
      },
      plan: {
        path: "pages/plans/plan-a.md",
        frontmatter: {
          id: "plan-a",
          type: "plan",
          title: "Plan A",
          status: "draft", // invalid for plan
          date: "2026-06-14",
          updated: "2026-06-14",
        },
      },
      review: {
        path: "pages/reviews/review-a.md",
        frontmatter: {
          id: "review-a",
          type: "review",
          title: "Review A",
          status: "draft", // invalid for review
          period: "weekly",
          updated: "2026-06-14",
        },
      },
      workflow: {
        path: "pages/workflows/workflow-a.md",
        frontmatter: {
          id: "workflow-a",
          type: "workflow",
          title: "Workflow A",
          status: "completed", // invalid for workflow
          updated: "2026-06-14",
          version: "1.0.0",
          triggers: ["daily"],
          summary: "concise",
        },
      },
    };

    for (const [pageType, fixture] of Object.entries(invalidByType)) {
      const root = await makeWikiRoot();
      const frontmatter = Object.entries(fixture.frontmatter)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}:\n${value.map((item) => `  - ${item}`).join("\n")}`;
          }
          return `${key}: ${value}`;
        })
        .join("\n");
      await writePage(root, fixture.path, `---\n${frontmatter}\n---\n`);

      const run = await runLint(root, "frontmatter");
      expect(run.issues.some((issue) => issue.message.includes("Invalid status"))).toBe(true);
    }
  });

  test("flags missing required frontmatter fields for each page type", async () => {
    const validByType: Record<string, { path: string; frontmatter: Record<string, unknown> }> = {
      summary: {
        path: "pages/summaries/source-min.md",
        frontmatter: {
          id: "SRC-MIN",
          type: "summary",
          title: "Source Min",
          status: "captured",
          captured_at: "2026-06-14",
          origin_type: "url",
          origin_value: "https://example.com/min",
          manifest_path: "inbox/min/manifest.json",
          raw_path: "inbox/min/raw.md",
          source_ids: ["SRC-MIN"],
          summary: "concise",
        },
      },
      topic: {
        path: "pages/topics/topic-min.md",
        frontmatter: {
          id: "topic-min",
          type: "topic",
          title: "Topic Min",
          status: "draft",
          updated: "2026-06-14",
          source_ids: ["SRC-TOPIC"],
          summary: "concise",
        },
      },
      plan: {
        path: "pages/plans/plan-min.md",
        frontmatter: {
          id: "plan-min",
          type: "plan",
          title: "Plan Min",
          status: "active",
          date: "2026-06-14",
          updated: "2026-06-14",
        },
      },
      review: {
        path: "pages/reviews/review-min.md",
        frontmatter: {
          id: "review-min",
          type: "review",
          title: "Review Min",
          status: "active",
          period: "weekly",
          updated: "2026-06-14",
        },
      },
      workflow: {
        path: "pages/workflows/workflow-min.md",
        frontmatter: {
          id: "workflow-min",
          type: "workflow",
          title: "Workflow Min",
          status: "draft",
          updated: "2026-06-14",
          version: "1.0.0",
          triggers: ["daily"],
          summary: "concise",
        },
      },
    };

    for (const [pageType, fixture] of Object.entries(validByType)) {
      const missingField = "title";
      const root = await makeWikiRoot();
      if (pageType === "topic") {
        await writePage(
          root,
          "pages/summaries/source-topic.md",
          `---
id: SRC-TOPIC
type: summary
title: Source Topic
status: captured
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/topic
manifest_path: inbox/topic/manifest.json
raw_path: inbox/topic/raw.md
source_ids:
  - SRC-TOPIC
summary: concise
---

# Source Topic
`
        );
      }
      const frontmatter = Object.entries(fixture.frontmatter)
        .filter(([key]) => key !== missingField)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}:\n${value.map((item) => `  - ${item}`).join("\n")}`;
          }
          return `${key}: ${value}`;
        })
        .join("\n");
      await writePage(root, fixture.path, `---\n${frontmatter}\n---\n# Title\n`);

      const run = await runLint(root, "frontmatter");
      expect(run.issues.some((issue) => issue.message.includes(`Missing required frontmatter field: ${missingField}`))).toBe(true);
    }
  });

  test("flags wiki links into inbox packets", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/topics/topic-a.md",
      `---
id: topic-a
type: topic
title: Topic A
status: draft
updated: 2026-06-14
source_ids: []
summary: concise
---

# Topic A

See [[inbox/source-a/raw]] for details.
`
    );

    const run = await runLint(root, "links");
    const inboxIssues = run.issues.filter((issue) => issue.message.includes("must not link to inbox"));
    expect(inboxIssues).toHaveLength(1);
    expect(run.issues.some((issue) => issue.message.includes("cannot be normalized"))).toBe(false);
  });

  test("flags wiki links into inbox packets even when a client is provided", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/topics/topic-a.md",
      `---
id: topic-a
type: topic
title: Topic A
status: draft
updated: 2026-06-14
source_ids: []
summary: concise
---

# Topic A

See [[inbox/source-a/raw]] for details.
`
    );

    const client = new ObsidianClient({ vaultCwd: root });
    client.unresolved = async () => [];

    const run = await runLint(root, "links", false, undefined, client);
    const inboxIssues = run.issues.filter((issue) => issue.message.includes("must not link to inbox"));
    expect(inboxIssues).toHaveLength(1);
    expect(run.issues.some((issue) => issue.message.includes("cannot be normalized"))).toBe(false);
  });

  test("accepts valid summary and topic pages", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/summaries/source-valid.md",
      `---
id: SRC-VALID
type: summary
title: Valid Source
status: integrated
captured_at: 2026-06-14
origin_type: url
origin_value: https://example.com/valid
manifest_path: inbox/valid/manifest.json
raw_path: inbox/valid/raw.md
source_ids:
  - SRC-VALID
summary: concise
integrated_at: 2026-06-14T10:00:00Z
---

# Valid Source
`
    );
    await writePage(
      root,
      "pages/topics/topic-valid.md",
      `---
id: topic-valid
type: topic
title: Valid Topic
status: integrated
updated: 2026-06-14
source_ids:
  - SRC-VALID
summary: concise
---

# Valid Topic
`
    );

    const run = await runLint(root, "frontmatter");
    const conformanceIssues = run.issues.filter(
      (issue) =>
        issue.message.includes("source_ids must be non-empty") ||
        issue.message.includes("source_ids must resolve to existing summary pages") ||
        issue.message.includes("Invalid status") ||
        issue.message.includes("integrated summary pages must set integrated_at")
    );
    expect(conformanceIssues).toHaveLength(0);
  });

  test("graph mode reports isolated wiki topics using Obsidian CLI", async () => {
    const root = await makeWikiRoot();
    await writePage(
      root,
      "pages/topics/orphan-topic.md",
      `---
id: orphan-topic
type: topic
title: Orphan Topic
status: draft
updated: 2026-06-14
source_ids:
  - SRC-1
summary: concise
---

# Orphan Topic
`
    );

    const client = new ObsidianClient({ vaultCwd: root });
    client.unresolved = async () => [];
    client.orphans = async () => [];
    client.deadends = async () => [];
    client.backlinks = async () => [];
    client.links = async () => [];
    client.properties = async () => ({});
    client.search = async () => [];

    const run = await runLint(root, "graph", false, undefined, client);

    expect(run.issues.length).toBeGreaterThan(0);
    expect(run.issues.some((issue) => issue.message.toLowerCase().includes("pkb"))).toBe(true);
  });
});
