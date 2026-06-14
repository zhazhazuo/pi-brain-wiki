# OKF Conformance Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit wiki conformance contract and enforce it through the existing lint pipeline without adding directory index generation or global `resource` schema expansion.

**Architecture:** Extend the current frontmatter lint flow in `extensions/brain-wiki/src/lint.ts` rather than creating a separate subsystem. Keep the contract readable in wiki schema docs and bootstrap output, cover the new checks with focused Bun tests, and only change template/schema defaults where the conformance rules require it.

**Tech Stack:** TypeScript (ESM), Bun test runner, existing wiki bootstrap/template generation, markdown schema docs

---

## File Structure

- Modify: `extensions/brain-wiki/src/lint.ts`
  - Add page-type conformance checks and relational validations to the existing frontmatter lint path.
- Create: `extensions/brain-wiki/src/lint.test.ts`
  - Focused tests for required fields, valid statuses, link restrictions, and summary/topic relational checks.
- Modify: `extensions/brain-wiki/src/scaffold.ts`
  - Update generated schema markdown so new vaults document the conformance rules.
- Modify: `README.md`
  - Keep the public docs aligned with the lint capability and page contract.
- Optional create: `docs/drafts/CONFORMANCE.md` or equivalent product-facing spec if implementation chooses a separate rendered spec file.
  - Only create this if the implementation needs a standalone artifact beyond `WIKI_SCHEMA.md`.

### Task 1: Add failing conformance tests

**Files:**
- Create: `extensions/brain-wiki/src/lint.test.ts`
- Modify: `extensions/brain-wiki/src/lint.ts`
- Test: `extensions/brain-wiki/src/lint.test.ts`

- [ ] **Step 1: Write the failing test file for page-type conformance**

```ts
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLint } from "./lint.ts";

async function makeWikiRoot() {
  const root = await mkdtemp(join(tmpdir(), "brain-wiki-lint-"));
  await mkdir(join(root, "pages", "summaries"), { recursive: true });
  await mkdir(join(root, "pages", "topics"), { recursive: true });
  await mkdir(join(root, "pages", "plans"), { recursive: true });
  await mkdir(join(root, "pages", "reviews"), { recursive: true });
  await mkdir(join(root, "pages", "workflows"), { recursive: true });
  await mkdir(join(root, "meta"), { recursive: true });
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
});
```

- [ ] **Step 2: Add failing tests for status validation and inbox link prohibition**

```ts
test("flags invalid status values for each page type", async () => {
  const root = await makeWikiRoot();
  await writePage(
    root,
    "pages/plans/plan-a.md",
    `---
id: plan-a
type: plan
title: Plan A
status: draft
date: 2026-06-14
updated: 2026-06-14
---

# Plan A
`
  );

  const run = await runLint(root, "frontmatter");
  expect(run.issues.some((issue) => issue.message.includes("Invalid status"))).toBe(true);
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
  expect(run.issues.some((issue) => issue.message.includes("must not link to inbox"))).toBe(true);
});
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `bun test extensions/brain-wiki/src/lint.test.ts`

Expected: `FAIL` with missing export/functionality in `lint.ts`, or assertions failing because the new conformance checks do not exist yet.

- [ ] **Step 4: Commit the failing test scaffold**

```bash
git add extensions/brain-wiki/src/lint.test.ts
git commit -m "test: add failing wiki conformance lint coverage"
```

### Task 2: Implement conformance checks inside the existing lint path

**Files:**
- Modify: `extensions/brain-wiki/src/lint.ts`
- Test: `extensions/brain-wiki/src/lint.test.ts`

- [ ] **Step 1: Add explicit status allowlists and helper predicates**

```ts
const VALID_STATUS: Record<string, readonly string[]> = {
  summary: ["captured", "integrated", "consumed", "archived", "cleared"],
  topic: ["draft", "integrated", "consumed", "archived", "cleared"],
  plan: ["active", "completed", "archived"],
  review: ["active", "completed", "archived"],
  workflow: ["draft", "active", "archived"],
};

function hasOwn(frontmatter: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(frontmatter, key);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
```

- [ ] **Step 2: Extend `lintFrontmatter()` with required-field and status-contract checks**

```ts
const status = String(page.frontmatter.status || "");
const validStatuses = VALID_STATUS[pageType];

if (!validStatuses?.includes(status)) {
  issues.push({
    kind: "frontmatter",
    severity: "error",
    path: page.relativePath,
    message: `Invalid status "${status}" for page type: ${pageType}`,
  });
}

if (pageType === "summary") {
  const sourceIds = asStringArray(page.frontmatter.source_ids);
  if (sourceIds.length === 0) {
    issues.push({
      kind: "frontmatter",
      severity: "error",
      path: page.relativePath,
      message: "summary.source_ids must be non-empty",
    });
  }
}
```

- [ ] **Step 3: Add cross-page validation for topic `source_ids` and summary integration state**

```ts
const summaryIds = new Set(
  pages
    .filter((entry) => String(entry.frontmatter.type) === "summary")
    .map((entry) => String(entry.frontmatter.id || ""))
    .filter(Boolean)
);

for (const page of pages) {
  const pageType = String(page.frontmatter.type || "");
  if (pageType === "topic") {
    for (const sourceId of asStringArray(page.frontmatter.source_ids)) {
      if (!summaryIds.has(sourceId)) {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: page.relativePath,
          message: "topic.source_ids must resolve to existing summary pages",
        });
      }
    }
  }

  if (pageType === "summary" && String(page.frontmatter.status) === "integrated" && !hasOwn(page.frontmatter, "integrated_at")) {
    issues.push({
      kind: "frontmatter",
      severity: "error",
      path: page.relativePath,
      message: "integrated summary pages must set integrated_at",
    });
  }
}
```

- [ ] **Step 4: Add a dedicated inbox-link prohibition in `lintLinks()`**

```ts
if (rawLink.startsWith("inbox/")) {
  issues.push({
    kind: "broken-link",
    severity: "error",
    path: page.relativePath,
    message: `Wiki pages must not link to inbox packets directly: [[${rawLink}]]`,
  });
  continue;
}
```

- [ ] **Step 5: Run the focused tests and make them pass**

Run: `bun test extensions/brain-wiki/src/lint.test.ts`

Expected: `PASS` with the new cases succeeding.

- [ ] **Step 6: Commit the conformance logic**

```bash
git add extensions/brain-wiki/src/lint.ts extensions/brain-wiki/src/lint.test.ts
git commit -m "feat: enforce wiki conformance in lint"
```

### Task 3: Document the contract in generated schema output

**Files:**
- Modify: `extensions/brain-wiki/src/scaffold.ts`
- Modify: `README.md`
- Test: `extensions/brain-wiki/src/lint.test.ts`

- [ ] **Step 1: Update `defaultSchemaMarkdown()` with the page-type contract that lint now enforces**

```ts
## Conformance

Lint enforces page-type contracts:

- `summary` requires `id`, `type`, `title`, `status`, `captured_at`, `origin_type`, `origin_value`, `manifest_path`, `raw_path`, `source_ids`, and `summary`
- `topic` requires `id`, `type`, `title`, `status`, `updated`, `source_ids`, and `summary`
- `plan` requires `id`, `type`, `title`, `status`, `date`, and `updated`
- `review` requires `id`, `type`, `title`, `status`, `period`, and `updated`
- `workflow` requires `id`, `type`, `title`, `status`, `updated`, `version`, `triggers`, and `summary`

Additional rules:

- Summary pages must keep `source_ids` non-empty
- Topic `source_ids` must point at existing summary pages when present
- Integrated summary pages must set `integrated_at`
- Wiki pages must not link directly to `inbox/**`
```

- [ ] **Step 2: Update the README lint/tooling description to mention conformance enforcement**

```md
| `wiki_lint` | Run deterministic health checks, including page-type conformance rules |
```

- [ ] **Step 3: Run the focused tests again after the documentation-side edit**

Run: `bun test extensions/brain-wiki/src/lint.test.ts`

Expected: `PASS`

- [ ] **Step 4: Run the project integrity check**

Run: `npm run check`

Expected: script exits `0`

- [ ] **Step 5: Commit the schema/doc alignment**

```bash
git add extensions/brain-wiki/src/scaffold.ts README.md
git commit -m "docs: document wiki conformance contract"
```

### Task 4: Verify whole-repo behavior and adjust any mismatched tests or docs

**Files:**
- Modify: `extensions/brain-wiki/src/lint.ts` if needed
- Modify: `extensions/brain-wiki/src/lint.test.ts` if needed
- Modify: `docs/04_modules/lint.md` if implementation behavior changed materially

- [ ] **Step 1: Run the wider brain-wiki test suite**

Run: `bun test extensions/brain-wiki/src`

Expected: all existing tests and the new lint tests pass.

- [ ] **Step 2: If a doc drift appears, update module documentation**

```md
- Seven lint checks: links, orphans, frontmatter, conformance, duplicates, coverage, staleness
- Frontmatter lint now includes page-type required fields, allowed statuses, and relational wiki rules
```

Only make this edit if the implementation meaningfully changes the documented module contract.

- [ ] **Step 3: Re-run the integrity check after any follow-up doc change**

Run: `npm run check`

Expected: script exits `0`

- [ ] **Step 4: Commit the final verification pass**

```bash
git add extensions/brain-wiki/src/lint.ts extensions/brain-wiki/src/lint.test.ts docs/04_modules/lint.md README.md extensions/brain-wiki/src/scaffold.ts
git commit -m "chore: finalize wiki conformance rollout"
```

## Self-Review

- Spec coverage:
  - conformance spec and lint enforcement -> Tasks 1-3
  - no directory index generation -> intentionally omitted from all tasks
  - `resource` deferred -> intentionally omitted from all tasks
- Placeholder scan:
  - no `TBD`/`TODO`
  - commands are explicit
  - file paths are explicit
- Type consistency:
  - plan uses `runLint()` as the existing entry point
  - all new checks stay inside existing `frontmatter`/`links` lint flows rather than inventing a separate subsystem
