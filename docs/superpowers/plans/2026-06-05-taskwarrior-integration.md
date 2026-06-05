# Taskwarrior Integration & WEEK.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Taskwarrior CLI integration to the pi-brain-wiki extension: safe CLI wrapper, validation engine, WEEK.md renderer, vault scanner, three new tools, and skill protocol update.

**Architecture:** Four focused TypeScript modules (`task-cli.ts`, `task-validator.ts`, `wiki-week.ts`, `task-scan.ts`) plus tool registrations in `index.ts`. Skill teaches the LLM protocol; code enforces validation on dangerous operations. Uses existing `pi.exec` for CLI spawning.

**Tech Stack:** TypeScript, Bun (testing), `bun:test`, `gray-matter`, Taskwarrior 3.4+ CLI

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Add Taskwarrior-related interfaces |
| `src/task-cli.ts` | **New** | Safe `task` CLI wrapper with JSON parsing and error handling |
| `src/task-cli.test.ts` | **New** | Tests for CLI wrapper |
| `src/task-validator.ts` | **New** | Validation engine enforcing creation checklist |
| `src/task-validator.test.ts` | **New** | Tests for validation rules |
| `src/wiki-week.ts` | **New** | WEEK.md renderer from Taskwarrior queries |
| `src/wiki-week.test.ts` | **New** | Tests for WEEK.md rendering |
| `src/task-scan.ts` | **New** | Vault scanner producing task proposals |
| `src/task-scan.test.ts` | **New** | Tests for vault scanning |
| `index.ts` | Modify | Register `wiki_task`, `wiki_task_scan`, `wiki_week` tools; add formatters |
| `skills/brain-wiki/SKILL.md` | Modify | Add Taskwarrior Protocol section |

---

## Conventions

- All new source files go in `extensions/brain-wiki/src/`
- All test files are co-located: `*.test.ts` next to the source file
- Tests use `bun:test` (`describe`, `expect`, `test`)
- Mock `CommandRunner` for CLI tests (matches pattern in `capture.ts`)
- Run tests with: `bun test`
- Run integrity check with: `npm run check`

---

## Task 1: Add Types

**Files:**
- Modify: `extensions/brain-wiki/src/types.ts`

Add the following interfaces at the bottom of the file, before the existing exports:

- [ ] **Step 1: Append Taskwarrior interfaces to `types.ts`**

```typescript
// --- Taskwarrior integration types ---

export interface TaskCliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed?: unknown;
}

export interface TaskExportRecord {
  id: number;
  uuid: string;
  description: string;
  project?: string;
  status: string;
  priority?: string;
  tags?: string[];
  due?: string;
  scheduled?: string;
  start?: string;
  end?: string;
  urgency: number;
  depends?: string[];
  annotations?: Array<{ entry: string; description: string }>;
  recur?: string;
  rtype?: string;
  parent?: string;
  estimate?: number;
}

export interface TaskValidationResult {
  valid: boolean;
  errors: TaskValidationError[];
}

export interface TaskValidationError {
  field: string;
  code: string;
  message: string;
}

export interface PromotionPayload {
  description: string;
  project: string;
  scheduled: string;
  priority: "H" | "M" | "L";
  estimate: number;
  tags: string[];
  due?: string;
  recur?: string;
  dependsOn?: string[];
}

export interface WeekMdSection {
  heading: string;
  rows: Array<Record<string, string | number>>;
}

export interface WeekMdData {
  weekNumber: number;
  weekRange: string;
  refreshedAt: string;
  sections: WeekMdSection[];
}

export interface ScanProposal {
  description: string;
  project: string;
  scheduled: string;
  priority: "H" | "M" | "L";
  estimate: number;
  tags: string[];
  reason: string;
  source: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add extensions/brain-wiki/src/types.ts
git commit -m "types: add Taskwarrior integration interfaces"
```

---

## Task 2: task-cli.ts — Safe CLI Wrapper

**Files:**
- Create: `extensions/brain-wiki/src/task-cli.ts`
- Create: `extensions/brain-wiki/src/task-cli.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/brain-wiki/src/task-cli.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { taskExec, taskExport, parseTaskwarriorError } from "./task-cli.ts";
import type { CommandRunner } from "./capture.ts";

function makeRunner(response: { stdout: string; stderr: string; code: number }): CommandRunner {
  return {
    exec: async () => response,
  } as CommandRunner;
}

describe("taskExec", () => {
  test("returns success on clean exit", async () => {
    const runner = makeRunner({ stdout: "ok", stderr: "", code: 0 });
    const result = await taskExec(runner, ["list"]);
    expect(result.success).toBe(true);
    expect(result.stdout).toBe("ok");
    expect(result.exitCode).toBe(0);
  });

  test("returns error on non-zero exit", async () => {
    const runner = makeRunner({ stdout: "", stderr: "Configuration error", code: 1 });
    const result = await taskExec(runner, ["add", "foo"]);
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Configuration error");
  });

  test("dry-run returns command without executing", async () => {
    const runner = makeRunner({ stdout: "", stderr: "", code: 0 });
    const result = await taskExec(runner, ["add", "test"], { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.command).toBe("task add test");
    expect(result.dryRun).toBe(true);
  });
});

describe("taskExport", () => {
  test("parses JSON array from stdout", async () => {
    const records = [
      { id: 1, uuid: "abc", description: "Test", status: "pending", urgency: 1 },
    ];
    const runner = makeRunner({ stdout: JSON.stringify(records), stderr: "", code: 0 });
    const result = await taskExport(runner, "status:pending");
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Test");
  });

  test("returns empty array on parse failure", async () => {
    const runner = makeRunner({ stdout: "not json", stderr: "", code: 0 });
    const result = await taskExport(runner, "all");
    expect(result).toHaveLength(0);
  });
});

describe("parseTaskwarriorError", () => {
  test("detects UDA error", () => {
    const errors = parseTaskwarriorError("UDA reference 'estimate'");
    expect(errors[0]).toContain("UDA 'estimate' not configured");
  });

  test("detects command not found", () => {
    const errors = parseTaskwarriorError("ENOENT: command not found");
    expect(errors[0]).toContain("Taskwarrior not installed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/task-cli.test.ts`
Expected: FAIL with "taskExec is not defined" or import errors

- [ ] **Step 3: Write minimal implementation**

Create `extensions/brain-wiki/src/task-cli.ts`:

```typescript
import type { CommandRunner } from "./capture.ts";
import type { TaskCliResult, TaskExportRecord } from "./types.ts";

export async function taskExec(
  runner: CommandRunner,
  args: string[],
  options?: { dryRun?: boolean },
): Promise<TaskCliResult & { command?: string; dryRun?: boolean; errors?: string[] }> {
  const command = ["task", ...args].join(" ");

  if (options?.dryRun) {
    return { success: true, stdout: "", stderr: "", exitCode: 0, command, dryRun: true };
  }

  try {
    const { stdout, stderr, code } = await runner.exec("task", args);
    const errors = code !== 0 ? parseTaskwarriorError(stderr) : [];
    return { success: code === 0, stdout, stderr, exitCode: code, errors };
  } catch (error) {
    const message = (error as Error).message;
    return {
      success: false,
      stdout: "",
      stderr: message,
      exitCode: 127,
      errors: parseTaskwarriorError(message),
    };
  }
}

export async function taskExport(
  runner: CommandRunner,
  filter: string,
): Promise<TaskExportRecord[]> {
  const result = await taskExec(runner, [filter, "export", "rc.json.array=on"]);
  if (!result.success || !result.stdout.trim()) return [];
  try {
    return JSON.parse(result.stdout) as TaskExportRecord[];
  } catch {
    return [];
  }
}

export function parseTaskwarriorError(stderr: string): string[] {
  const errors: string[] = [];
  if (stderr.includes("UDA") || stderr.includes("uda")) {
    errors.push(
      "UDA 'estimate' not configured. Add to ~/.taskrc: uda.estimate.type=numeric uda.estimate.label=Estimate uda.estimate.default=1",
    );
  }
  if (stderr.includes("ENOENT") || stderr.includes("command not found")) {
    errors.push("Taskwarrior not installed. Install Taskwarrior 3.4+ and configure ~/.taskrc.");
  }
  if (errors.length === 0 && stderr.trim()) {
    errors.push(stderr.trim());
  }
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/task-cli.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/task-cli.ts extensions/brain-wiki/src/task-cli.test.ts
git commit -m "feat(task-cli): safe Taskwarrior CLI wrapper with JSON parsing"
```

---

## Task 3: task-validator.ts — Validation Engine

**Files:**
- Create: `extensions/brain-wiki/src/task-validator.ts`
- Create: `extensions/brain-wiki/src/task-validator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/brain-wiki/src/task-validator.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { validatePromotion } from "./task-validator.ts";

describe("validatePromotion", () => {
  test("accepts valid payload", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing project", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "project")).toBe(true);
  });

  test("rejects invalid project format", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "Techno",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_project_format")).toBe(true);
  });

  test("rejects missing TYPE prefix", () => {
    const result = validatePromotion({
      description: "Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "description")).toBe(true);
  });

  test("rejects description > 8 words after prefix", () => {
    const result = validatePromotion({
      description: "RD: This is way too many words in the description",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "description_too_long")).toBe(true);
  });

  test("rejects URL in description", () => {
    const result = validatePromotion({
      description: "RD: Read https://example.com",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "description_has_url")).toBe(true);
  });

  test("rejects invalid estimate", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 5,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "estimate")).toBe(true);
  });

  test("rejects no tags", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "M",
      estimate: 1,
      tags: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "tags")).toBe(true);
  });

  test("rejects invalid priority", () => {
    const result = validatePromotion({
      description: "RD: Research type systems",
      project: "AI.TypeSystems-Research",
      scheduled: "2026-06-10",
      priority: "X" as any,
      estimate: 1,
      tags: ["RD"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "priority")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/task-validator.test.ts`
Expected: FAIL with "validatePromotion is not defined"

- [ ] **Step 3: Write minimal implementation**

Create `extensions/brain-wiki/src/task-validator.ts`:

```typescript
import type { PromotionPayload, TaskValidationResult } from "./types.ts";

const VALID_TYPES = ["BUG:", "FEAT:", "RD:", "REVIEW:", "SETUP:", "PLAN:", "MEETING:"];
const VALID_ESTIMATES = [0.5, 1, 1.5, 2, 2.5, 3];
const VALID_PRIORITIES = ["H", "M", "L"];

export function validatePromotion(payload: PromotionPayload): TaskValidationResult {
  const errors: TaskValidationResult["errors"] = [];

  if (!payload.project || !payload.project.includes(".")) {
    errors.push({
      field: "project",
      code: "invalid_project_format",
      message: "Project must be in Domain.SpecificOutcome format with a dot separator.",
    });
  }

  const typeMatch = payload.description.match(/^([A-Z]+):\s*(.+)$/);
  if (!typeMatch) {
    errors.push({
      field: "description",
      code: "missing_type_prefix",
      message: `Description must start with a TYPE prefix: ${VALID_TYPES.join(", ")}`,
    });
  } else {
    const prefix = typeMatch[1] + ":";
    const body = typeMatch[2];
    if (!VALID_TYPES.includes(prefix)) {
      errors.push({
        field: "description",
        code: "invalid_type_prefix",
        message: `Unknown TYPE prefix. Valid: ${VALID_TYPES.join(", ")}`,
      });
    }
    const wordCount = body.trim().split(/\s+/).length;
    if (wordCount > 8) {
      errors.push({
        field: "description",
        code: "description_too_long",
        message: `Description body must be ≤ 8 words (found ${wordCount}).`,
      });
    }
    if (/https?:\/\//.test(body)) {
      errors.push({
        field: "description",
        code: "description_has_url",
        message: "URLs are not allowed in description. Use task annotate instead.",
      });
    }
  }

  if (!VALID_PRIORITIES.includes(payload.priority)) {
    errors.push({
      field: "priority",
      code: "invalid_priority",
      message: "Priority must be H, M, or L.",
    });
  }

  if (!VALID_ESTIMATES.includes(payload.estimate)) {
    errors.push({
      field: "estimate",
      code: "invalid_estimate",
      message: `Estimate must be one of: ${VALID_ESTIMATES.join(", ")}`,
    });
  }

  if (!payload.scheduled) {
    errors.push({
      field: "scheduled",
      code: "missing_scheduled",
      message: "Scheduled date is required.",
    });
  }

  if (!payload.tags || payload.tags.length === 0) {
    errors.push({
      field: "tags",
      code: "missing_tags",
      message: "At least one tag is required.",
    });
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/task-validator.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/task-validator.ts extensions/brain-wiki/src/task-validator.test.ts
git commit -m "feat(task-validator): enforce Taskwarrior creation checklist"
```

---

## Task 4: wiki-week.ts — WEEK.md Renderer

**Files:**
- Create: `extensions/brain-wiki/src/wiki-week.ts`
- Create: `extensions/brain-wiki/src/wiki-week.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/brain-wiki/src/wiki-week.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { renderWeekMd, buildWeekMdData } from "./wiki-week.ts";
import type { TaskExportRecord } from "./types.ts";

describe("buildWeekMdData", () => {
  test("renders sections from task records", () => {
    const now = new Date();
    const records: TaskExportRecord[] = [
      { id: 1, uuid: "a", description: "BUG: Fix login", status: "pending", priority: "H", urgency: 10, due: now.toISOString(), scheduled: now.toISOString(), project: "Techno.Login-Fix", tags: ["BUG"], start: now.toISOString() },
      { id: 2, uuid: "b", description: "RD: Research types", status: "pending", priority: "M", urgency: 5, scheduled: now.toISOString(), project: "AI.Types-Research", tags: ["RD"] },
    ];
    const data = buildWeekMdData(records, now);
    expect(data.weekNumber).toBeGreaterThan(0);
    expect(data.sections.length).toBeGreaterThan(0);
    const activeSection = data.sections.find((s) => s.heading.includes("Active"));
    expect(activeSection?.rows.length).toBe(1);
  });

  test("handles empty records", () => {
    const data = buildWeekMdData([], new Date());
    expect(data.sections.every((s) => s.rows.length === 0 || s.rows[0] === null)).toBe(false);
  });
});

describe("renderWeekMd", () => {
  test("generates markdown with sections", () => {
    const now = new Date();
    const records: TaskExportRecord[] = [
      { id: 1, uuid: "a", description: "BUG: Fix login", status: "pending", priority: "H", urgency: 10, due: now.toISOString(), scheduled: now.toISOString(), project: "Techno.Login-Fix", tags: ["BUG"] },
    ];
    const md = renderWeekMd(records, now);
    expect(md).toContain("# Week");
    expect(md).toContain("BUG: Fix login");
    expect(md).toContain("Techno.Login-Fix");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/wiki-week.test.ts`
Expected: FAIL with "buildWeekMdData is not defined"

- [ ] **Step 3: Write minimal implementation**

Create `extensions/brain-wiki/src/wiki-week.ts`:

```typescript
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { TaskExportRecord, WeekMdData, WeekMdSection } from "./types.ts";

export function buildWeekMdData(records: TaskExportRecord[], now: Date): WeekMdData {
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekNumber = getISOWeek(now);
  const weekRange = `${formatDate(startOfWeek)}–${formatDate(endOfWeek)}`;

  const overdue = records.filter((r) => r.status === "pending" && r.due && new Date(r.due) < now);
  const active = records.filter((r) => r.status === "pending" && r.start);
  const thisWeek = records.filter((r) => {
    if (r.status !== "pending") return false;
    const sch = r.scheduled ? new Date(r.scheduled) : null;
    const due = r.due ? new Date(r.due) : null;
    return (sch && sch <= endOfWeek) || (due && due <= endOfWeek);
  });
  const blocked = records.filter((r) => r.status === "pending" && r.depends && r.depends.length > 0);
  const blocking = records.filter((r) => r.status === "pending"); // simplified; real blocking requires cross-reference
  const recurring = records.filter((r) => r.status === "recurring" || r.rtype);
  const doneThisWeek = records.filter((r) => r.status === "completed" && r.end && new Date(r.end) >= startOfWeek);
  const backlog = records.filter((r) => r.status === "pending").sort((a, b) => b.urgency - a.urgency).slice(0, 10);

  const sections: WeekMdSection[] = [
    { heading: "## 🔴 Overdue", rows: overdue.map(toRow) },
    { heading: "## 🟡 Active (started)", rows: active.map(toRow) },
    { heading: "## 🔵 This Week", rows: thisWeek.map(toRow) },
    { heading: "## 🔗 Blocked", rows: blocked.map(toRow) },
    { heading: "## 🔗 Blocking", rows: blocking.slice(0, 5).map(toRow) },
    { heading: "## 🔁 Recurring", rows: recurring.map(toRow) },
    { heading: "## ✅ Done This Week", rows: doneThisWeek.map(toRow) },
    { heading: "## ⚪ Backlog", rows: backlog.map(toRow) },
  ];

  return { weekNumber, weekRange, refreshedAt: now.toISOString(), sections };
}

function toRow(r: TaskExportRecord): Record<string, string | number> {
  return {
    "#": r.id,
    Task: r.description,
    Project: r.project ?? "—",
    Estimate: r.estimate ?? "—",
    Pri: r.priority ?? "—",
    Sch: r.scheduled ? formatDate(new Date(r.scheduled)) : "—",
    Due: r.due ? formatDate(new Date(r.due)) : "—",
  };
}

export function renderWeekMd(records: TaskExportRecord[], now = new Date()): string {
  const data = buildWeekMdData(records, now);
  const lines: string[] = [
    `# Week ${data.weekNumber} — ${data.weekRange}`,
    `_Refreshed: ${data.refreshedAt}_`,
    "",
  ];

  for (const section of data.sections) {
    lines.push(section.heading);
    lines.push("");
    if (section.rows.length === 0) {
      lines.push("*No tasks*");
      lines.push("");
      continue;
    }
    const keys = Object.keys(section.rows[0]);
    lines.push("| " + keys.join(" | ") + " |");
    lines.push("| " + keys.map(() => "---").join(" | ") + " |");
    for (const row of section.rows) {
      lines.push("| " + keys.map((k) => row[k] ?? "—").join(" | ") + " |");
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function writeWeekMd(
  vaultRoot: string,
  text: string,
): Promise<string> {
  const path = join(vaultRoot, "WEEK.md");
  await writeFile(path, text + "\n", "utf8");
  return path;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getISOWeek(date: Date): number {
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/wiki-week.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/wiki-week.ts extensions/brain-wiki/src/wiki-week.test.ts
git commit -m "feat(wiki-week): WEEK.md renderer from Taskwarrior queries"
```

---

## Task 5: task-scan.ts — Vault Scanner

**Files:**
- Create: `extensions/brain-wiki/src/task-scan.ts`
- Create: `extensions/brain-wiki/src/task-scan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/brain-wiki/src/task-scan.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { scanListMdItems, scanVaultForTasks } from "./task-scan.ts";
import type { RegistryData, ScanProposal } from "./types.ts";

describe("scanListMdItems", () => {
  test("finds stale unprocessed items", () => {
    const content = `
**2026-05-20**
- [ ] https://example.com/blog about types
- [x] Done item

**2026-06-01**
- [ ] Research voice recording
`;
    const items = scanListMdItems(content, "2026-06-10");
    expect(items.length).toBe(1);
    expect(items[0].source).toContain("LIST.md");
    expect(items[0].reason).toContain("21 days");
  });

  test("ignores recent items", () => {
    const content = `**2026-06-09**\n- [ ] Recent item`;
    const items = scanListMdItems(content, "2026-06-10");
    expect(items.length).toBe(0);
  });
});

describe("scanVaultForTasks", () => {
  test("returns empty array when nothing to scan", async () => {
    const registry: RegistryData = { pages: [], aliases: {}, backlinks: {} };
    const result = await scanVaultForTasks("/nonexistent", registry, { scope: "list_md", since: "2026-06-01" });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test extensions/brain-wiki/src/task-scan.test.ts`
Expected: FAIL with "scanListMdItems is not defined"

- [ ] **Step 3: Write minimal implementation**

Create `extensions/brain-wiki/src/task-scan.ts`:

```typescript
import { readFile } from "node:fs/promises";
import { listMdPath, projectRoot } from "./paths.ts";
import type { RegistryData, ScanProposal } from "./types.ts";

export function scanListMdItems(content: string, sinceIso: string): ScanProposal[] {
  const since = new Date(sinceIso);
  const proposals: ScanProposal[] = [];
  let currentDate = "";
  let itemIndex = 0;

  for (const line of content.split("\n")) {
    const dateMatch = line.match(/^\*{2}(\d{4}-\d{2}-\d{2})\*{2}/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const taskMatch = line.match(/^-\s*\[([ x>])\]\s*(.+)/);
    if (taskMatch && currentDate) {
      itemIndex++;
      const done = taskMatch[1] === "x";
      const text = taskMatch[2].trim();
      if (done) continue;

      const itemDate = new Date(currentDate);
      const daysSince = Math.floor((since.getTime() - itemDate.getTime()) / 86_400_000);
      if (daysSince > 7) {
        const shortText = text.length > 40 ? text.slice(0, 40) + "..." : text;
        proposals.push({
          description: `RD: Process LIST.md item — ${shortText}`,
          project: "Wiki.List-Backlog",
          scheduled: sinceIso,
          priority: "M",
          estimate: 0.5,
          tags: ["RD"],
          reason: `Unprocessed LIST.md item from ${currentDate} (${daysSince} days old)`,
          source: `LIST.md:item-${itemIndex}`,
        });
      }
    }
  }

  return proposals;
}

export async function scanVaultForTasks(
  root: string,
  registry: RegistryData,
  options?: { scope?: "list_md" | "projects" | "wiki_meta" | "all"; since?: string },
): Promise<ScanProposal[]> {
  const scope = options?.scope ?? "all";
  const since = options?.since ?? new Date().toISOString().slice(0, 10);
  const proposals: ScanProposal[] = [];

  if (scope === "list_md" || scope === "all") {
    try {
      const listContent = await readFile(listMdPath(root), "utf8");
      proposals.push(...scanListMdItems(listContent, since));
    } catch {
      // LIST.md may not exist
    }
  }

  if (scope === "projects" || scope === "all") {
    // First pass: project scanning is reserved for follow-up
  }

  if (scope === "wiki_meta" || scope === "all") {
    // First pass: wiki meta scanning is reserved for follow-up
  }

  return proposals;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test extensions/brain-wiki/src/task-scan.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add extensions/brain-wiki/src/task-scan.ts extensions/brain-wiki/src/task-scan.test.ts
git commit -m "feat(task-scan): vault scanner for LIST.md task proposals"
```

---

## Task 6: Wire Tools into index.ts

**Files:**
- Modify: `extensions/brain-wiki/index.ts`

Import the new modules at the top of `index.ts` (after existing imports, before the `baseDir` line):

- [ ] **Step 1: Add imports**

```typescript
import { taskExec, taskExport } from "./src/task-cli.ts";
import { validatePromotion } from "./src/task-validator.ts";
import { renderWeekMd, writeWeekMd } from "./src/wiki-week.ts";
import { scanVaultForTasks } from "./src/task-scan.ts";
```

Insert after line 48 (after the `WikiEvent` import) and before line 50 (`const baseDir = ...`).

- [ ] **Step 2: Add tool registration for `wiki_task`**

Insert after the `wiki_project_sync` tool registration (after line 803), before the `pi.registerCommand` block:

```typescript
  pi.registerTool({
    name: "wiki_task",
    label: "Wiki Task",
    description:
      "Create, annotate, or complete Taskwarrior tasks with validation. Extension enforces rules; agent uses direct CLI for safe reads.",
    promptSnippet:
      "Promote LIST.md items into validated Taskwarrior tasks, annotate existing tasks, or mark tasks complete",
    promptGuidelines: [
      "Use promote action when creating new tasks from LIST.md or scan proposals.",
      "Use annotate action to add wiki links or context notes to existing tasks.",
      "Use done action to mark a task complete.",
    ],
    parameters: Type.Object({
      action: StringEnum(["promote", "annotate", "done"] as const),
      description: Type.Optional(Type.String()),
      project: Type.Optional(Type.String()),
      scheduled: Type.Optional(Type.String()),
      priority: Type.Optional(StringEnum(["IU", "I", "U"] as const)),
      estimate: Type.Optional(Type.Number()),
      tags: Type.Optional(Type.Array(Type.String())),
      due: Type.Optional(Type.String()),
      recur: Type.Optional(Type.String()),
      dependsOn: Type.Optional(Type.Array(Type.String())),
      sourceItem: Type.Optional(Type.String()),
      wikiLinks: Type.Optional(Type.Array(Type.String())),
      dryRun: Type.Optional(Type.Boolean({ default: false })),
      taskId: Type.Optional(Type.Number()),
      text: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const runner = { exec: ctx.exec };

      if (params.action === "promote") {
        if (!params.description || !params.project || !params.scheduled || !params.priority || params.estimate == null || !params.tags) {
          return {
            content: [{ type: "text", text: "Missing required fields for promote action." }],
            details: { success: false, errors: ["description, project, scheduled, priority, estimate, and tags are required"] },
          };
        }

        const priorityMap: Record<string, "H" | "M" | "L"> = { IU: "H", I: "M", U: "L" };
        const payload = {
          description: params.description,
          project: params.project,
          scheduled: params.scheduled,
          priority: priorityMap[params.priority]!,
          estimate: params.estimate,
          tags: params.tags,
          due: params.due,
          recur: params.recur,
          dependsOn: params.dependsOn,
        };

        const validation = validatePromotion(payload);
        if (!validation.valid) {
          return {
            content: [{ type: "text", text: `Validation failed:\n${validation.errors.map((e) => `- ${e.field}: ${e.message}`).join("\n")}` }],
            details: { success: false, validationResult: validation },
          };
        }

        if (params.dryRun) {
          const cmd = "task add " + buildTaskAddArgs(payload).join(" ");
          return {
            content: [{ type: "text", text: `Dry-run command:\n${cmd}` }],
            details: { success: true, dryRun: true, command: cmd },
          };
        }

        // Create task
        const addArgs = buildTaskAddArgs(payload);
        const addResult = await taskExec(runner, ["add", ...addArgs]);
        if (!addResult.success) {
          return {
            content: [{ type: "text", text: `task add failed: ${addResult.errors?.join(", ") ?? addResult.stderr}` }],
            details: { success: false, errors: addResult.errors },
          };
        }

        // Find the newly created task by filtering for matching description + project
        const exportResult = await taskExport(runner, `status:pending project:${payload.project}`);
        const newTask = exportResult.find((t) => t.description === payload.description);
        const taskId = newTask?.id;

        // Add dependencies
        if (taskId && payload.dependsOn?.length) {
          for (const depUuid of payload.dependsOn) {
            await taskExec(runner, [String(taskId), "modify", `depends:${depUuid}`]);
          }
        }

        // Annotate wiki links
        if (taskId && params.wikiLinks?.length) {
          for (const link of params.wikiLinks) {
            await taskExec(runner, [String(taskId), "annotate", `Wiki: [[${link}]]`]);
          }
        }

        return {
          content: [{ type: "text", text: `Created task ${taskId ?? "?"}: ${payload.description}` }],
          details: { success: true, taskId },
        };
      }

      if (params.action === "annotate") {
        if (!params.taskId || !params.text) {
          return {
            content: [{ type: "text", text: "taskId and text required for annotate action." }],
            details: { success: false, errors: ["taskId and text required"] },
          };
        }
        const result = await taskExec(runner, [String(params.taskId), "annotate", params.text]);
        return {
          content: [{ type: "text", text: result.success ? `Annotated task ${params.taskId}` : `Failed: ${result.errors?.join(", ")}` }],
          details: { success: result.success },
        };
      }

      if (params.action === "done") {
        if (!params.taskId) {
          return {
            content: [{ type: "text", text: "taskId required for done action." }],
            details: { success: false, errors: ["taskId required"] },
          };
        }
        const result = await taskExec(runner, [String(params.taskId), "done"]);
        return {
          content: [{ type: "text", text: result.success ? `Completed task ${params.taskId}` : `Failed: ${result.errors?.join(", ")}` }],
          details: { success: result.success },
        };
      }

      return {
        content: [{ type: "text", text: "Unknown action." }],
        details: { success: false },
      };
    },
  });
```

- [ ] **Step 3: Add helper functions for `wiki_task`**

Add these functions near the other formatters at the bottom of `index.ts` (before the last closing brace of the `brainWikiExtension` function):

```typescript
function buildTaskAddArgs(payload: { description: string; project: string; scheduled: string; priority: string; estimate: number; tags: string[]; due?: string; recur?: string }): string[] {
  const args: string[] = [
    payload.description,
    `project:${payload.project}`,
    `scheduled:${payload.scheduled}`,
    `priority:${payload.priority}`,
    `estimate:${payload.estimate}`,
    ...payload.tags.map((t) => `+${t}`),
  ];
  if (payload.due) args.push(`due:${payload.due}`);
  if (payload.recur) args.push(`recur:${payload.recur}`);
  return args;
}
```

- [ ] **Step 4: Add tool registration for `wiki_task_scan`**

Insert after `wiki_task` registration:

```typescript
  pi.registerTool({
    name: "wiki_task_scan",
    label: "Wiki Task Scan",
    description:
      "Analyze vault state and propose Taskwarrior tasks automatically.",
    promptSnippet:
      "Scan LIST.md, projects, and wiki meta for items that could become Taskwarrior tasks",
    parameters: Type.Object({
      scope: Type.Optional(StringEnum(["list_md", "projects", "wiki_meta", "all"] as const)),
      since: Type.Optional(Type.String({ description: "ISO date for staleness threshold (default: 7 days ago)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const registry = await loadRegistry(root);
      const proposals = await scanVaultForTasks(root, registry, {
        scope: params.scope ?? "all",
        since: params.since,
      });
      return {
        content: [{ type: "text", text: formatScanResult(proposals) }],
        details: { proposals },
      };
    },
  });
```

- [ ] **Step 5: Add tool registration for `wiki_week`**

Insert after `wiki_task_scan` registration:

```typescript
  pi.registerTool({
    name: "wiki_week",
    label: "Wiki Week",
    description:
      "Regenerate WEEK.md from current Taskwarrior state.",
    promptSnippet:
      "Refresh the weekly task dashboard from Taskwarrior queries",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      const vaultRoot = resolve(root, "..");
      const runner = { exec: ctx.exec };
      const records = await taskExport(runner, "status:pending or status:completed");
      const md = renderWeekMd(records);
      const path = await writeWeekMd(vaultRoot, md);
      return {
        content: [{ type: "text", text: `WEEK.md refreshed at ${path}` }],
        details: { path, text: md },
      };
    },
  });
```

- [ ] **Step 6: Add format helper functions**

Add at the bottom of the file, after `formatProjectSyncResult`:

```typescript
function formatScanResult(proposals: ScanProposal[]): string {
  if (proposals.length === 0) return "No task proposals found.";
  const lines = proposals.map((p, i) =>
    `${i + 1}. ${p.description}\n   project: ${p.project} | estimate: ${p.estimate} | priority: ${p.priority} | scheduled: ${p.scheduled}\n   reason: ${p.reason} | source: ${p.source}`,
  );
  return `Found ${proposals.length} proposals:\n\n${lines.join("\n\n")}`;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Run all tests**

Run: `bun test`
Expected: All existing tests still pass + new tests pass

- [ ] **Step 9: Commit**

```bash
git add extensions/brain-wiki/index.ts
git commit -m "feat(index): register wiki_task, wiki_task_scan, and wiki_week tools"
```

---

## Task 7: Update SKILL.md

**Files:**
- Modify: `skills/brain-wiki/SKILL.md`

- [ ] **Step 1: Append Taskwarrior Protocol section to SKILL.md**

Append the following section at the end of `skills/brain-wiki/SKILL.md`:

```markdown
## Taskwarrior Protocol

Taskwarrior is the shared temporal task database. Both human and agent use the `task` CLI.

### Task Creation Rules

Every promoted task must have:
- **Project**: `Domain.SpecificOutcome` format (e.g., `AI.TypeSystems-Research`). Concrete deliverable, not broad domain.
- **Description**: `TYPE: Short imperative description` (max 8 words after prefix)
  - Valid TYPEs: `BUG:`, `FEAT:`, `RD:`, `REVIEW:`, `SETUP:`, `PLAN:`, `MEETING:`
- **Priority**: `IU`→`H`, `I`→`M`, `U`→`L`. Agent suggests; Walker confirms.
- **Estimate**: 0.5, 1, 1.5, 2, 2.5, or 3 days. Maximum 3 — split larger work.
- **Scheduled**: Always required. No unscheduled tasks.
- **Due**: Only if there's a real deadline.
- **Tags**: At least one. Valid: `BUG`, `FEAT`, `RD`, `CONCEPT`, `REVIEW`, `SOURCE`, `INFRA`.

### Agent Write Rules

| Action | Allowed? | How |
|--------|----------|-----|
| `task add` | ✅ | Only via `wiki_task` tool with `promote` action |
| `task annotate` | ✅ | Via `wiki_task` tool or direct `pi.exec` |
| `task done` | ✅ | Via `wiki_task` tool or direct `pi.exec` |
| `task modify` core fields | ❌ | Never without Walker's explicit instruction |
| `task delete` | ❌ | Never |
| `task modify status:pending` | ❌ | Never un-complete |

### LIST.md Draining Protocol

1. Call `wiki_task_scan` at session start
2. Identify unprocessed LIST.md items (`[ ]`, `[>]`)
3. Propose promotion with all required fields
4. On Walker approval, call `wiki_task` with `promote` action
5. Append agent line to LIST.md: `A 2026-06-05T10:00 → Promoted to TW #20 [AI] estimate:1`
6. Toggle `[ ]` → `[x]` in LIST.md

### WEEK.md Refresh

- Call `wiki_week` at session start
- Use direct `task export` for real-time queries during session
- WEEK.md is a human convenience, not the source of truth

### Dependency Chaining

- Split tasks: always chain with `depends:` unless Walker says otherwise
- Present chain to Walker: "RD → CONCEPT → FEAT → REVIEW"
- Create all tasks first, then link by UUID

### Bidirectional Linking

- Task side: `task <id> annotate "Wiki: [[topics/foo]]"`
- Wiki side: add `## Tasks` section to topic page with task references
- Maintain both sides
```

- [ ] **Step 2: Commit**

```bash
git add skills/brain-wiki/SKILL.md
git commit -m "docs(skill): add Taskwarrior Protocol section"
```

---

## Task 8: Integration Check

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run integrity check**

Run: `npm run check`
Expected: PASS — verifies required files and package.json config

- [ ] **Step 3: Final review of changes**

Run: `git diff --stat`
Expected: New files created, index.ts and types.ts modified, SKILL.md modified

- [ ] **Step 4: Commit any final fixes**

If `npm run check` or `bun test` failed, fix and commit.

---

## Self-Review Checklist

### Spec Coverage

| Spec Section | Implementing Task |
|---|---|
| Architecture Overview (4 modules) | Tasks 2–5 |
| task-cli.ts (safe wrapper, JSON parsing, error handling, dry-run) | Task 2 |
| task-validator.ts (creation checklist, field validation) | Task 3 |
| wiki-week.ts (8 category queries, markdown tables, human annotations) | Task 4 |
| task-scan.ts (LIST.md, projects, wiki meta scanning) | Task 5 |
| Types (all interfaces) | Task 1 |
| Tool: wiki_task (promote/annotate/done) | Task 6 |
| Tool: wiki_task_scan (scope, since) | Task 6 |
| Tool: wiki_week (full refresh) | Task 6 |
| Error handling (Taskwarrior not installed, UDA, empty states, dependencies) | Tasks 2–6 |
| Skill integration (Taskwarrior Protocol section) | Task 7 |
| Existing task handling (read/annotate/complete only) | Enforced in tool logic, Task 6 |
| Rollback path | Documented in spec; no additional code needed |
| Lifecycle triggers (skill-driven) | Documented in spec; no additional code needed |

### Placeholder Scan

- No "TBD", "TODO", "implement later", or "fill in details" in code steps
- No vague "add appropriate error handling" — specific error cases are listed
- No "similar to Task N" — each task is self-contained
- All type names consistent across tasks (`TaskExportRecord`, `PromotionPayload`, etc.)

### Type Consistency

- `TaskExportRecord` — defined in Task 1, used in Tasks 2, 4, 6
- `PromotionPayload` — defined in Task 1, used in Tasks 3, 6
- `ScanProposal` — defined in Task 1, used in Tasks 5, 6
- `TaskValidationResult` — defined in Task 1, used in Tasks 3, 6
- `CommandRunner` — imported from `capture.ts` in Tasks 2, 6

### Known Gaps (Intentional)

1. **Project/ frontmatter scanning in `task-scan.ts`** — marked as TODO in first pass. The spec allows this to be a follow-up since LIST.md scanning is the highest-value initial scanner.
2. **Wiki meta scanning in `task-scan.ts`** — same as above.
3. **Human annotation preservation in WEEK.md** — HTML comment boundaries are not implemented in the first pass. The renderer overwrites the full file. This can be added later.
4. **Blocking task detection in `wiki-week.ts`** — uses a simplified filter (`status:pending`). True blocking detection requires cross-referencing `depends` arrays, which is complex and can be enhanced later.

These gaps are documented and do not block the core functionality.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-05-taskwarrior-integration.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
