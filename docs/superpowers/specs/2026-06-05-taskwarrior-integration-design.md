# Taskwarrior Integration & WEEK.md — Design Specification

> Scope: Full Taskwarrior integration — LIST.md draining, WEEK.md generation, bidirectional wiki linking, automatic vault scanning, recurrence, and dependency chaining.
> Status: **approved** — ready for implementation planning.
> Date: 2026-06-05

## Goal

Give the brain-wiki extension a shared temporal task database using Taskwarrior. Both human and agent read/write the same `task` CLI. The wiki becomes the planning layer: LIST.md is the inlet, Taskwarrior is the engine, WEEK.md is the human-readable dashboard.

## What We Get

| Capability | Before | After |
|---|---|---|
| Task state | LIST.md only — flat, no dates, no priorities | Taskwarrior DB with Eisenhower priorities, estimates, scheduling |
| Weekly view | None | WEEK.md auto-generated at PARA root every session |
| Task creation | Agent adds to LIST.md | Agent promotes LIST.md items into validated Taskwarrior tasks |
| Vault scan | Activity scan only (`wiki_scan_activity`) | Proactive task proposals from stale projects, unintegrated sources, old LIST items |
| Recurrence | None | Recurring tasks for weekly lint, review, area check-in |
| Dependencies | None | Chained sub-tasks with `depends:` for split work |
| Wiki linking | One-way (task annotates wiki link) | Bidirectional: task ↔ wiki topic page |

## What Stays Out

- Sync server setup (Taskwarrior 3 `task sync` is available but not configured by this extension)
- Burndown / ghistory / calendar graphical reports
- Custom Taskwarrior hooks
- Waiting / context / timesheet features (agent can use them via direct CLI, extension doesn't surface tools)

---

## Section 1: Architecture Overview

Four new TypeScript modules. Three new extension tools. One skill update.

### New Modules

| Module | File | Responsibility |
|--------|------|---------------|
| `task-cli.ts` | `extensions/brain-wiki/src/task-cli.ts` | Safe `task` CLI wrapper: spawns `pi.exec`, parses JSON export, handles errors, supports dry-run |
| `task-validator.ts` | `extensions/brain-wiki/src/task-validator.ts` | Validation engine: enforces the creation checklist (project format, TYPE prefix, estimate range, etc.) |
| `wiki-week.ts` | `extensions/brain-wiki/src/wiki-week.ts` | WEEK.md renderer: queries Taskwarrior via `task export`, formats markdown tables, writes to PARA root |
| `task-scan.ts` | `extensions/brain-wiki/src/task-scan.ts` | Vault scanner: reads LIST.md, project frontmatter, wiki activity, produces proposed tasks |

### Data Flow

```
LIST.md ──► task-scan.ts ──► Agent presents ──► task-validator.ts ──► task-cli.ts ──► Taskwarrior DB
                              (proposals)        (enforces rules)      (dry-run or exec)

Taskwarrior DB ──► task-cli.ts (task export) ──► wiki-week.ts ──► WEEK.md (PARA root)

Vault scan ──► task-scan.ts ──► Proposed tasks ──► Agent presents ──► task-validator ──► task-cli
```

### Agent Interaction Modes

- **Direct CLI** (via `pi.exec`) for safe operations: `task list`, `task export`, `task annotate`, `task done`, `task +BLOCKED`, `task +BLOCKING`
- **Extension tools** for controlled operations: `wiki_task` (LIST.md promotion, scan results), `wiki_week` (WEEK.md refresh)
- **Skill rules** govern when to use each mode

---

## Section 2: New Extension Modules

### 2.1 `task-cli.ts` — Safe CLI Wrapper

**Responsibilities:**
- Spawn `task` subcommands via `pi.exec`
- Parse JSON from `task export` with `rc.json.array=on`
- Handle "command not found", UDA errors, malformed JSON
- Support dry-run mode (show command without executing)
- Return structured `TaskCliResult`

**Key functions:**

```typescript
async function taskExec(
  piExec: ExtensionAPI["exec"],
  args: string[],
  options?: { dryRun?: boolean },
): Promise<TaskCliResult>;

async function taskExport(
  piExec: ExtensionAPI["exec"],
  filter: string,
): Promise<TaskExportRecord[]>;

function parseTaskwarriorError(stderr: string): string[];
```

**Error detection:**
- `ENOENT` / "command not found" → `"Taskwarrior not installed"`
- `UDA reference` in stderr → `"UDA 'estimate' not configured. Add to ~/.taskrc: uda.estimate.type=numeric..."`
- Non-JSON stdout from export → `"Taskwarrior returned non-JSON output"`

### 2.2 `task-validator.ts` — Validation Engine

**Responsibilities:**
- Enforce the creation checklist on every `promote` action
- Map `IU`/`I`/`U` → `H`/`M`/`L`
- Validate project format: `Domain.SpecificOutcome` (alphanumeric, kebab-case after dot)
- Validate TYPE prefix: `BUG:`, `FEAT:`, `RD:`, `REVIEW:`, `SETUP:`, `PLAN:`, `MEETING:`
- Validate description: ≤ 8 words after prefix, no URLs, no markdown, imperative mood
- Validate estimate: must be in `0.5, 1, 1.5, 2, 2.5, 3`
- Validate scheduled: ISO date or named date expression
- Validate tags: ≥ 1 tag
- Validate dependencies: check for circular chains, verify UUIDs exist in current export

**Key function:**

```typescript
function validatePromotion(payload: PromotionPayload): TaskValidationResult;
```

**Validation failure:** Returns `{ valid: false, errors: [{ field, code, message }] }`. No `task add` executed. Agent sees errors and asks Walker to fix.

### 2.3 `wiki-week.ts` — WEEK.md Renderer

**Responsibilities:**
- Query Taskwarrior via `task export` for 7 categories:
  1. Overdue (`task status:pending +OVERDUE export`)
  2. Active (`task status:pending +ACTIVE export`)
  3. This Week (`task status:pending '(due.before:eow or scheduled.before:eow)' export`)
  4. Blocked (`task +BLOCKED export`)
  5. Blocking (`task +BLOCKING export`)
  6. Recurring (`task recurring export`)
  7. Done This Week (`task status:completed end.after:sow export`)
  8. Backlog (`task status:pending limit:10 next export` — top 10 by urgency)
- Render markdown tables matching the design structure
- Append "Linked Wiki Topics" section if wiki link annotations exist
- Write to `<vault-root>/WEEK.md`

**Key function:**

```typescript
async function renderWeekMd(
  piExec: ExtensionAPI["exec"],
  vaultRoot: string,
): Promise<{ path: string; text: string }>;
```

**Vacant states:** If a category has zero tasks, render the section heading with a "No tasks" row. Never omit the section.

**Human annotations:** If WEEK.md contains human text outside the generated sections, preserve it. Generated sections are bounded by HTML comments (`<!-- BEGIN:week-section -->` / `<!-- END:week-section -->`).

### 2.4 `task-scan.ts` — Vault Scanner

**Responsibilities:**
- Scan LIST.md for unprocessed items older than 7 days
- Scan `Project/` frontmatter for stale `next_action` / `last_action`
- Scan `Wiki/meta/` for thin/stale topics
- Scan `Wiki/pages/summaries/` for unintegrated source packets
- Scan wiki topic `## Open questions` sections
- Produce `ScanProposal[]` with full required fields

**Key function:**

```typescript
async function scanVaultForTasks(
  root: string,
  registry: RegistryData,
  options?: { scope?: "list_md" | "projects" | "wiki_meta" | "all"; since?: string },
): Promise<ScanProposal[]>;
```

**Rules:**
- Agent proposes, Walker decides. Never auto-creates.
- Every proposal includes `reason` — why this item surfaced.
- Proposals include `source` provenance (e.g., `"LIST.md:item-3"`, `"Project/Sales-Tool-DC:stale-next-action"`)
- Dismissed proposals: tracked via annotation on the source item or LIST.md agent line to avoid re-proposing next session.

---

## Section 3: New Extension Tools

### Tool: `wiki_task`

**Description:** Create, annotate, or complete Taskwarrior tasks with validation. Extension enforces rules; agent uses direct CLI for safe reads.

**Parameters:**

```typescript
Type.Object({
  action: StringEnum(["promote", "annotate", "done"] as const),
  // promote fields
  description: Type.Optional(Type.String()),
  project: Type.Optional(Type.String()),
  scheduled: Type.Optional(Type.String()),
  priority: Type.Optional(StringEnum(["IU", "I", "U"] as const)),
  estimate: Type.Optional(Type.Number()),
  tags: Type.Optional(Type.Array(Type.String())),
  due: Type.Optional(Type.String()),
  recur: Type.Optional(Type.String()),
  dependsOn: Type.Optional(Type.Array(Type.String())), // UUIDs
  sourceItem: Type.Optional(Type.String()), // LIST.md item text reference
  wikiLinks: Type.Optional(Type.Array(Type.String())), // wiki page paths to annotate
  dryRun: Type.Optional(Type.Boolean({ default: false })),
  // annotate/done fields
  taskId: Type.Optional(Type.Number()),
  text: Type.Optional(Type.String()), // for annotate
})
```

**Actions:**

| Action | Condition | Behavior |
|--------|-----------|----------|
| `promote` | Validation passes | Spawn `task add`, then `task modify depends:<uuid>` for each `dependsOn` entry, then `task annotate` for wiki links, then append agent line to LIST.md if `sourceItem` provided, then return task ID |
| `promote` | Validation fails | Return `details.validationResult` with field-level errors. No `task add` executed. |
| `promote` | `dryRun=true` | Show formatted `task add` command string without executing. |
| `annotate` | Always | Spawn `task <id> annotate "<text>"`. |
| `done` | Always | Spawn `task <id> done`. If `sourceItem` provided, toggle `[ ]` → `[x]` in LIST.md. |

**Return value:**

```typescript
{
  content: [{ type: "text", text: string }],
  details: {
    success: boolean;
    errors?: string[];
    taskId?: number;
    validationResult?: TaskValidationResult;
    command?: string; // for dry-run
  }
}
```

### Tool: `wiki_task_scan`

**Description:** Analyze vault state and propose Taskwarrior tasks automatically.

**Parameters:**

```typescript
Type.Object({
  scope: Type.Optional(StringEnum(["list_md", "projects", "wiki_meta", "all"] as const)),
  since: Type.Optional(Type.String({ description: "ISO date for staleness threshold (default: 7 days ago)" })),
})
```

**Returns:**

```typescript
{
  content: [{ type: "text", text: string }], // formatted proposal list
  details: {
    proposals: ScanProposal[];
  }
}
```

### Tool: `wiki_week`

**Description:** Regenerate WEEK.md from current Taskwarrior state.

**Parameters:** `Type.Object({})` — no parameters, always full refresh.

**Returns:**

```typescript
{
  content: [{ type: "text", text: string }], // rendered WEEK.md text
  details: {
    path: string;
    text: string;
  }
}
```

---

## Section 4: Types

Additions to `extensions/brain-wiki/src/types.ts`:

```typescript
// task-cli.ts
interface TaskCliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed?: unknown;
}

interface TaskExportRecord {
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

// task-validator.ts
interface TaskValidationResult {
  valid: boolean;
  errors: TaskValidationError[];
}

interface TaskValidationError {
  field: string;
  code: string;
  message: string;
}

interface PromotionPayload {
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

// wiki-week.ts
interface WeekMdSection {
  heading: string;
  rows: Array<Record<string, string | number>>;
}

interface WeekMdData {
  weekNumber: number;
  weekRange: string;
  refreshedAt: string;
  sections: WeekMdSection[];
}

// task-scan.ts
interface ScanProposal {
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

---

## Section 5: Error Handling & Edge Cases

### Taskwarrior Not Installed
- `task-cli.ts` detects `ENOENT` on spawn
- Returns `success: false, errors: ["Taskwarrior not installed. Install Taskwarrior 3.4+ and configure ~/.taskrc."]`
- All tools degrade gracefully: `wiki_week` returns error instead of writing file; `wiki_task` returns error without attempting CLI

### UDA Not Configured
- `task-cli.ts` detects `UDA reference` in stderr
- Returns actionable error: `"UDA 'estimate' not configured. Add to ~/.taskrc: uda.estimate.type=numeric uda.estimate.label=Estimate uda.estimate.default=1"`

### Empty States
- WEEK.md with zero tasks: render all sections with "No tasks" rows
- Task scan with no proposals: return `proposals: []`
- LIST.md with no unprocessed items: `task-scan.ts` returns empty array

### Dependency Failures
- If `dependsOn` contains a UUID not found in current `task export`, skip that dependency and log a warning. Don't fail the whole chain.
- Circular dependency: validator rejects with error `"Circular dependency detected: <uuid-1> → <uuid-2> → <uuid-1>"`

### Concurrency
- Taskwarrior 3 SQLite handles concurrent reads/writes via WAL. Extension relies on this.
- WEEK.md file write uses existing `withFileMutationQueue` from `index.ts`.
- No additional extension-level locking for DB operations.

---

## Section 6: Skill Integration

The agent skill (`skills/brain-wiki/SKILL.md`) gets a new **Taskwarrior Protocol** section.

**What the skill teaches the LLM:**

1. **Task Creation Rules**
   - Project: `Domain.SpecificOutcome` format, concrete not broad
   - Description: `TYPE: Short imperative description` (max 8 words after prefix)
   - Priority mapping: `IU`→`H`, `I`→`M`, `U`→`L`
   - Estimate: 0.5–3 days, split if >3
   - Scheduled: always required; due: only if real deadline
   - Tags: ≥ 1 (BUG, FEAT, RD, CONCEPT, REVIEW, SOURCE, INFRA)

2. **Agent Write Rules**
   - `task add` → only via `wiki_task` tool with `promote` action (enforced)
   - `task annotate` → via `wiki_task` tool with `annotate` action, or direct `pi.exec` for existing tasks
   - `task done` → via `wiki_task` tool with `done` action, or direct `pi.exec`
   - `task modify` on core fields → ❌ Never without Walker's explicit instruction
   - `task delete` → ❌ Never
   - `task modify status:pending` → ❌ Never un-complete

3. **LIST.md Draining Protocol**
   - Read LIST.md at session start
   - Identify unprocessed items (`[ ]`, `[>]`)
   - Propose promotion with all required fields
   - On promotion: append agent line to LIST.md, toggle `[ ]` → `[x]`

4. **Dependency Chaining**
   - Split tasks: always chain with `depends:` unless Walker says otherwise
   - Present chain to Walker: "RD → CONCEPT → FEAT → REVIEW"
   - Create all tasks first, then link by UUID

5. **WEEK.md Refresh**
   - Call `wiki_week` at session start
   - Use direct `task export` for real-time queries during the session
   - WEEK.md is a human convenience, not the source of truth

6. **Bidirectional Linking**
   - Task side: `task <id> annotate "Wiki: [[topics/foo]]"`
   - Wiki side: add `## Tasks` section to topic page with task references
   - Maintain both sides

---

## Section 7: Taskwarrior UDA Setup

Required in `~/.taskrc`:

```
uda.estimate.type=numeric
uda.estimate.label=Estimate
uda.estimate.default=1
uda.estimate.values=0.5,1,1.5,2,2.5,3
```

The extension checks for this UDA on first use and surfaces a clear setup error if missing.

---

## Section 8: Existing Task Handling

The user already has 8 tasks in Taskwarrior. Rules:

- **Read:** Agent queries existing tasks freely via direct `pi.exec`
- **Annotate:** Agent can add wiki links, context notes to any existing task
- **Complete:** Agent can `task done` existing tasks if it performed the work
- **Modify core fields:** ❌ Never. Project, priority, estimate, scheduled, due — all require Walker's explicit instruction
- **Legacy naming:** Tasks without `TYPE:` prefix are surfaced in WEEK.md as-is. Agent does NOT auto-rename or modify them

---

## Section 9: File Summary

| File | Action | Lines (est) |
|------|--------|-------------|
| `src/task-cli.ts` | **New** | ~80 |
| `src/task-validator.ts` | **New** | ~120 |
| `src/wiki-week.ts` | **New** | ~150 |
| `src/task-scan.ts` | **New** | ~180 |
| `src/types.ts` | Add interfaces | ~50 new |
| `index.ts` | Register 3 new tools, wire lifecycle | ~80 new |
| `skills/brain-wiki/SKILL.md` | Add Taskwarrior Protocol section | ~80 new |
| `docs/superpowers/specs/2026-06-05-taskwarrior-integration-design.md` | **New** | ~400 |

**Total: ~560 lines new code + ~80 lines skill + ~400 lines spec.**

---

## Section 10: Rollback

If the integration causes issues:

1. Disable tools: comment out the 3 `pi.registerTool` calls in `index.ts`
2. Remove skill section: delete the Taskwarrior Protocol section from `SKILL.md`
3. Delete the 4 new module files
4. Delete `WEEK.md` from PARA root if it exists
5. Taskwarrior database (`~/.task/`) is untouched — all tasks remain
6. LIST.md is untouched except for agent lines (which are just text)

No persistent state is stored in the wiki vault except WEEK.md. Zero risk of data loss.

---

## Section 11: What's NOT Changing

These files are untouched:
- `src/scaffold.ts`, `src/capture.ts`, `src/lint.ts`, `src/activity.ts`
- `src/guards.ts`, `src/frontmatter.ts`, `src/log.ts`, `src/paths.ts`, `src/config.ts`, `src/slug.ts`
- `src/search.ts`, `src/indexer.ts`, `src/sync.ts`, `src/triage.ts`, `src/project-sync.ts`, `src/workflow.ts`
- Existing tool registrations (no parameter changes to existing tools)
- Existing commands (`wiki-status`, `wiki-lint`, `wiki-rebuild`, `wiki-consumed`)
- All test files (new tests will be added for new modules)
- Package dependencies (no new npm packages needed — uses existing `pi.exec`)

---

## Section 12: Lifecycle Triggers (Skill-Driven)

The extension provides tools. The skill governs when to call them:

1. **Session start:** Skill instructs agent to call `wiki_task_scan` (scope: `all`) and `wiki_week`
2. **LIST.md interaction:** Skill instructs agent to propose promotion when unprocessed items are found
3. **Task completion:** Skill instructs agent to call `wiki_task` with `done` action and update wiki topic pages
4. **Weekly review:** Skill instructs agent to use `task +BLOCKED`, `task +BLOCKING`, and `task +READY` via direct CLI for ad-hoc queries

The extension does NOT auto-trigger anything. All timing is skill-driven.
