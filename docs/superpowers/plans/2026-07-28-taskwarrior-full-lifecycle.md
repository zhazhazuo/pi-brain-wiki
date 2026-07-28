# Taskwarrior Full-Lifecycle Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the agent guarded full-lifecycle task management — validated `modify` and audit-logged `delete` actions on `wiki_task` — so a project/topic discussion can end in confirmed create/modify/done/delete change sets.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-28-taskwarrior-full-lifecycle-design.md`. A new `validateModification()` extends the existing validator; two new handlers in `handleWikiTaskAction` execute through `taskExec` only; delete audits to the wiki event log via the already-imported `appendEvent`. Skill prose documents the discuss → propose → confirm → execute loop and the close+recreate identity pattern.

**Tech Stack:** TypeScript extension (Node strip-types), Bun test (`bun test`), pi skill files (markdown).

## Global Constraints

- Run tests with `bun test extensions/brain-wiki/src/` (tests import `bun:test`; plain `node --test` FAILS).
- Run package sanity with `npm run check`.
- 3 pre-existing test failures are known and out of scope (context-guards, project-sync ISO-week, context-gather-agent). Suite baseline: 175 pass / 3 fail.
- Description/TYPE are immutable: `modify` must refuse when `description` is present.
- Un-complete stays forbidden. `done` is final.
- The agent never runs raw `task modify` / `task delete` — all writes go through `wiki_task`.
- Priority params use the existing convention: enum `IU`/`I`/`U`, mapped via `priorityMap` to `H`/`M`/`L`.
- Status tags are exactly: `IN_PROGRESS`, `REVIEW`, `BLOCKED`, `STALE` — max one per task.
- Do not touch promote/annotate/done logic, WEEK.md, the workshop skill, or LIST.md handling.
- Progress file: `.ai-artifacts/progress/taskwarrior-workshop-redesign.md` — controller updates it after completion.

---

### Task 1: `ModificationPayload` + `validateModification` (TDD)

**Files:**

- Modify: `extensions/brain-wiki/src/types.ts` (after `PromotionPayload`, ~line 740)
- Modify: `extensions/brain-wiki/src/task-validator.ts`
- Test: `extensions/brain-wiki/src/task-validator.test.ts`

**Interfaces:**

- Consumes: existing `TaskValidationResult`, `VALID_ESTIMATES`, `VALID_PRIORITIES` patterns in task-validator.ts.
- Produces:
  - `export interface ModificationPayload { taskId: number; scheduled?: string; priority?: "H" | "M" | "L"; estimate?: number; due?: string; recur?: string; project?: string; addTags?: string[]; removeTags?: string[]; dependsOn?: string[]; }`
  - `export function validateModification(payload: ModificationPayload): TaskValidationResult`
  - Error codes: `empty_modification`, `invalid_project_format`, `invalid_priority`, `invalid_estimate`, `too_many_status_tags` — Task 2's handler and tests rely on these exact codes.

- [ ] **Step 1: Write the failing tests**

Append to `extensions/brain-wiki/src/task-validator.test.ts` (the import line already imports `validatePromotion` — extend it to also import `validateModification`):

```ts
describe("validateModification", () => {
  test("accepts a minimal valid modification", () => {
    const result = validateModification({ taskId: 5, scheduled: "2026-07-30" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts a full valid modification", () => {
    const result = validateModification({
      taskId: 5,
      scheduled: "2026-07-30",
      priority: "H",
      estimate: 1.5,
      due: "2026-08-01",
      project: "AI.TypeSystems-Research",
      addTags: ["IN_PROGRESS"],
      removeTags: ["BLOCKED"],
      dependsOn: ["uuid-1"],
    });
    expect(result.valid).toBe(true);
  });

  test("rejects an empty modification", () => {
    const result = validateModification({ taskId: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("empty_modification");
  });

  test("rejects invalid project format", () => {
    const result = validateModification({ taskId: 5, project: "NoDot" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("invalid_project_format");
  });

  test("rejects invalid priority", () => {
    const result = validateModification({ taskId: 5, priority: "X" as any });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("invalid_priority");
  });

  test("rejects invalid estimate", () => {
    const result = validateModification({ taskId: 5, estimate: 4 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("invalid_estimate");
  });

  test("rejects more than one status tag in addTags", () => {
    const result = validateModification({
      taskId: 5,
      addTags: ["IN_PROGRESS", "BLOCKED"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.code).toBe("too_many_status_tags");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test extensions/brain-wiki/src/task-validator.test.ts`
Expected: FAIL — `validateModification is not exported`.

- [ ] **Step 3: Add the type**

In `extensions/brain-wiki/src/types.ts`, immediately after the `PromotionPayload` interface, add:

```ts
export interface ModificationPayload {
  taskId: number;
  scheduled?: string;
  priority?: "H" | "M" | "L";
  estimate?: number;
  due?: string;
  recur?: string;
  project?: string;
  addTags?: string[];
  removeTags?: string[];
  dependsOn?: string[];
}
```

- [ ] **Step 4: Implement the validator**

In `extensions/brain-wiki/src/task-validator.ts`, update the import to include `ModificationPayload`:

```ts
import type { ModificationPayload, PromotionPayload, TaskValidationResult } from "./types.ts";
```

Add the constant after `VALID_PRIORITIES`:

```ts
const STATUS_TAGS = ["IN_PROGRESS", "REVIEW", "BLOCKED", "STALE"];
```

Append the function at the end of the file:

```ts
export function validateModification(payload: ModificationPayload): TaskValidationResult {
  const errors: TaskValidationResult["errors"] = [];

  const hasChange =
    payload.scheduled != null ||
    payload.priority != null ||
    payload.estimate != null ||
    payload.due != null ||
    payload.recur != null ||
    payload.project != null ||
    (payload.addTags?.length ?? 0) > 0 ||
    (payload.removeTags?.length ?? 0) > 0 ||
    (payload.dependsOn?.length ?? 0) > 0;
  if (!hasChange) {
    errors.push({
      field: "modify",
      code: "empty_modification",
      message: "At least one field to modify is required.",
    });
  }

  if (payload.project != null && !payload.project.includes(".")) {
    errors.push({
      field: "project",
      code: "invalid_project_format",
      message: "Project must be in Domain.SpecificOutcome format with a dot separator.",
    });
  }

  if (payload.priority != null && !VALID_PRIORITIES.includes(payload.priority)) {
    errors.push({
      field: "priority",
      code: "invalid_priority",
      message: "Priority must be H, M, or L.",
    });
  }

  if (payload.estimate != null && !VALID_ESTIMATES.includes(payload.estimate)) {
    errors.push({
      field: "estimate",
      code: "invalid_estimate",
      message: `Estimate must be one of: ${VALID_ESTIMATES.join(", ")}`,
    });
  }

  if ((payload.addTags ?? []).filter((t) => STATUS_TAGS.includes(t)).length > 1) {
    errors.push({
      field: "addTags",
      code: "too_many_status_tags",
      message: `At most one status tag (${STATUS_TAGS.join(", ")}) is allowed.`,
    });
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test extensions/brain-wiki/src/task-validator.test.ts`
Expected: PASS — 18 tests (11 existing + 7 new).

- [ ] **Step 6: Commit**

```bash
git add extensions/brain-wiki/src/types.ts extensions/brain-wiki/src/task-validator.ts extensions/brain-wiki/src/task-validator.test.ts
git commit -m "feat: add ModificationPayload type and validateModification"
```

---

### Task 2: `wiki_task` modify + delete handlers

**Files:**

- Modify: `extensions/brain-wiki/index.ts` (EVENT_KIND_ENUM ~line 141; `wiki_task` registration ~line 1316; `handleWikiTaskAction` ~line 1900)
- Modify: `extensions/brain-wiki/src/types.ts` (`WikiEventKind` ~line 263)

**Interfaces:**

- Consumes: Task 1's `validateModification` and `ModificationPayload`; existing `priorityMap`, `taskExec`, `taskExport`, `appendEvent` (already imported in index.ts at line 36), `resolveWikiRoot`.
- Produces: `handleWikiTaskAction(pi, params, root)` — three-parameter signature (root returns for the delete audit); actions `"modify"` and `"delete"` on `wiki_task`; event kind `"task-delete"` on `WikiEventKind` and `EVENT_KIND_ENUM`.

- [ ] **Step 1: Add the event kind**

In `extensions/brain-wiki/src/types.ts`, extend `WikiEventKind` — add this line after `| "cleared";`... concretely: change

```ts
  | "archived"
  | "cleared";
```

to

```ts
  | "archived"
  | "cleared"
  | "task-delete";
```

In `extensions/brain-wiki/index.ts`, extend `EVENT_KIND_ENUM` — change

```ts
  "archived",
  "cleared",
] as const);
```

to

```ts
  "archived",
  "cleared",
  "task-delete",
] as const);
```

- [ ] **Step 2: Update the `wiki_task` registration**

Change the action enum line:

```ts
      action: StringEnum(["promote", "annotate", "done"] as const),
```

to:

```ts
      action: StringEnum(["promote", "annotate", "done", "modify", "delete"] as const),
```

Add three parameters after `text: Type.Optional(Type.String()),`:

```ts
      addTags: Type.Optional(Type.Array(Type.String())),
      removeTags: Type.Optional(Type.Array(Type.String())),
      confirm: Type.Optional(Type.Boolean({ default: false })),
```

Add two guidelines after `"Use done action to mark a task complete.",`:

```ts
      "Use modify action for validated field changes after Walker confirms the change set; description and TYPE are immutable.",
      "Use delete action only with confirm: true after Walker's explicit approval; deletion is audit-logged to the wiki event log.",
```

Update the description string from:

```ts
      "Create validated Taskwarrior tasks from a confirmed draft, annotate existing tasks, or mark tasks complete",
```

to:

```ts
      "Create, modify, annotate, complete, or delete Taskwarrior tasks with validation. All writes are validated and confirmed; description/TYPE are immutable.",
```

Change the execute body from:

```ts
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      return handleWikiTaskAction(pi, params) as any;
    },
```

to:

```ts
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = await resolveWikiRoot(ctx.cwd);
      return handleWikiTaskAction(pi, params, root) as any;
    },
```

- [ ] **Step 3: Update the handler signature and imports**

Change:

```ts
async function handleWikiTaskAction(
  pi: ExtensionAPI,
  params: Record<string, unknown>,
) {
```

to:

```ts
async function handleWikiTaskAction(
  pi: ExtensionAPI,
  params: Record<string, unknown>,
  root: string,
) {
```

Update the validator import in index.ts from:

```ts
import { validatePromotion } from "./src/task-validator.ts";
```

to:

```ts
import { validateModification, validatePromotion } from "./src/task-validator.ts";
```

Add `ModificationPayload` to the types import block (alphabetical position near `PromotionPayload`... place it on its own line with the other type imports from `./src/types.ts`).

- [ ] **Step 4: Add the modify handler**

Insert this block immediately before the `if (params.action === "annotate") {` line:

```ts
  if (params.action === "modify") {
    if (!params.taskId) {
      return {
        content: [
          { type: "text", text: "TaskId is required for modify action." },
        ],
        details: { success: false, errors: ["TaskId is required."] },
      };
    }
    if (params.description) {
      return {
        content: [
          {
            type: "text",
            text: "Description/TYPE is immutable identity — close the task (done) and create a new one (promote) instead.",
          },
        ],
        details: { success: false, errors: ["immutable_identity"] },
      };
    }

    const modification: ModificationPayload = {
      taskId: Number(params.taskId),
      scheduled: params.scheduled ? String(params.scheduled) : undefined,
      priority: params.priority
        ? priorityMap[String(params.priority)]
        : undefined,
      estimate: params.estimate != null ? Number(params.estimate) : undefined,
      due: params.due ? String(params.due) : undefined,
      recur: params.recur ? String(params.recur) : undefined,
      project: params.project ? String(params.project) : undefined,
      addTags: params.addTags as string[] | undefined,
      removeTags: params.removeTags as string[] | undefined,
      dependsOn: params.dependsOn as string[] | undefined,
    };

    const validation = validateModification(modification);
    if (!validation.valid) {
      return {
        content: [
          {
            type: "text",
            text: `Validation failed:\n${validation.errors.map((e) => `- ${e.field}: ${e.message}`).join("\n")}`,
          },
        ],
        details: { success: false, validationResult: validation },
      };
    }

    const id = Number(params.taskId);
    const existing = (await taskExport(runner, String(id)))[0];
    if (!existing) {
      return {
        content: [{ type: "text", text: `Task ${id} not found.` }],
        details: { success: false, errors: [`Task ${id} not found.`] },
      };
    }

    const STATUS_TAGS = ["IN_PROGRESS", "REVIEW", "BLOCKED", "STALE"];
    const existingTags = existing.tags ?? [];
    const mergedTags = [
      ...existingTags.filter((t) => !(modification.removeTags ?? []).includes(t)),
      ...(modification.addTags ?? []).filter((t) => !existingTags.includes(t)),
    ];
    if (mergedTags.filter((t) => STATUS_TAGS.includes(t)).length > 1) {
      return {
        content: [
          {
            type: "text",
            text: "Resulting tag set would have more than one status tag (IN_PROGRESS, REVIEW, BLOCKED, STALE).",
          },
        ],
        details: { success: false, errors: ["too_many_status_tags"] },
      };
    }

    const args: string[] = [String(id), "modify"];
    const changes: string[] = [];
    if (modification.scheduled) {
      args.push(`scheduled:${modification.scheduled}`);
      changes.push(`scheduled: ${existing.scheduled ?? "—"} → ${modification.scheduled}`);
    }
    if (modification.priority) {
      args.push(`priority:${modification.priority}`);
      changes.push(`priority: ${existing.priority ?? "—"} → ${modification.priority}`);
    }
    if (modification.estimate != null) {
      args.push(`estimate:${modification.estimate}`);
      changes.push(`estimate: ${existing.estimate ?? "—"} → ${modification.estimate}`);
    }
    if (modification.due) {
      args.push(`due:${modification.due}`);
      changes.push(`due: ${existing.due ?? "—"} → ${modification.due}`);
    }
    if (modification.recur) {
      args.push(`recur:${modification.recur}`);
      changes.push(`recur: ${existing.recur ?? "—"} → ${modification.recur}`);
    }
    if (modification.project) {
      args.push(`project:${modification.project}`);
      changes.push(`project: ${existing.project ?? "—"} → ${modification.project}`);
    }
    for (const tag of modification.addTags ?? []) args.push(`+${tag}`);
    for (const tag of modification.removeTags ?? []) args.push(`-${tag}`);
    if (modification.addTags?.length || modification.removeTags?.length) {
      changes.push(`tags: ${existingTags.join(",") || "—"} → ${mergedTags.join(",")}`);
    }
    if (modification.dependsOn?.length) {
      args.push(`depends:${modification.dependsOn.join(",")}`);
      changes.push(`depends: → ${modification.dependsOn.join(",")}`);
    }

    const result = await taskExec(runner, args);
    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Task modify failed: ${result.errors?.join(", ") ?? result.stderr}`,
          },
        ],
        details: { success: false, errors: result.errors },
      };
    }

    const stamp = new Date().toISOString().slice(0, 10);
    await taskExec(runner, [
      String(id),
      "annotate",
      `${stamp}: modified ${changes.join("; ")}`,
    ]);

    return {
      content: [
        { type: "text", text: `Modified task ${id}: ${changes.join("; ")}` },
      ],
      details: { success: true, taskId: id, changes },
    };
  }
```

- [ ] **Step 5: Add the delete handler**

Insert this block immediately before the final `return { content: [{ type: "text", text: "Unknown action." }], ... };` of `handleWikiTaskAction`:

```ts
  if (params.action === "delete") {
    if (!params.taskId) {
      return {
        content: [
          { type: "text", text: "TaskId is required for delete action." },
        ],
        details: { success: false, errors: ["TaskId is required."] },
      };
    }
    if (params.confirm !== true) {
      return {
        content: [
          {
            type: "text",
            text: "Deletion requires Walker's explicit confirmation — re-call with confirm: true after he approves.",
          },
        ],
        details: { success: false, errors: ["confirmation_required"] },
      };
    }

    const id = Number(params.taskId);
    const record = (await taskExport(runner, String(id)))[0];
    if (!record) {
      return {
        content: [{ type: "text", text: `Task ${id} not found.` }],
        details: { success: false, errors: [`Task ${id} not found.`] },
      };
    }

    const result = await taskExec(runner, [
      "rc.confirmation=off",
      String(id),
      "delete",
    ]);
    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Task delete failed: ${result.errors?.join(", ") ?? result.stderr}`,
          },
        ],
        details: { success: false, errors: result.errors },
      };
    }

    await appendEvent(root, {
      ts: new Date().toISOString(),
      kind: "task-delete",
      title: `Deleted task ${id}: ${record.description}`,
      notes: [
        `project:${record.project ?? "—"}`,
        `scheduled:${record.scheduled ?? "—"}`,
        `priority:${record.priority ?? "—"}`,
        `estimate:${record.estimate ?? "—"}`,
        `tags:${(record.tags ?? []).join(",") || "—"}`,
        `uuid:${record.uuid ?? "—"}`,
      ],
      actor: "agent",
    });

    return {
      content: [
        {
          type: "text",
          text: `Deleted task ${id}: ${record.description} (audit logged to wiki events)`,
        },
      ],
      details: { success: true, taskId: id },
    };
  }
```

- [ ] **Step 6: Verify compilation and run the suite**

```bash
grep -n "handleWikiTaskAction(pi, params" extensions/brain-wiki/index.ts
bun test extensions/brain-wiki/src/
```

Expected: the call site and the definition both show the three-parameter form; suite at 178+ pass / only the 3 known pre-existing failures.

- [ ] **Step 7: Commit**

```bash
git add extensions/brain-wiki/index.ts extensions/brain-wiki/src/types.ts
git commit -m "feat: wiki_task modify + delete actions with validation and audit"
```

---

### Task 3: taskwarrior skill documents the full lifecycle

**Files:**

- Modify: `skills/taskwarrior/SKILL.md`
- Modify: `skills/taskwarrior/instructions/creation-rules.md` (Agent Write Rules table, ~line 92)
- Modify: `skills/taskwarrior/instructions/session-workflow.md`

**Interfaces:**

- Consumes: Task 2 (`wiki_task` modify/delete actions exist; modify refuses `description`).
- Produces: prose only; no new tools.

- [ ] **Step 1: Update `creation-rules.md` Agent Write Rules**

Replace the whole table:

```markdown
| Action | Allowed? | How |
|--------|----------|-----|
| `task add` | ✅ | Only via `wiki_task(promote)`. All fields required. |
| `task annotate` | ✅ | Via `wiki_task(annotate)` or direct `task <id> annotate` |
| `task done` | ✅ | Via `wiki_task(done)` or direct `task <id> done` |
| `task modify` core fields | ❌ | Never without Walker's explicit instruction |
| `task delete` | ❌ | Never |
| Un-complete a task | ❌ | Never |
| Modify immutable fields (description, project, TYPE) | ❌ | Never. Close task and create new one instead. |
```

with:

```markdown
| Action | Allowed? | How |
|--------|----------|-----|
| `task add` | ✅ | Only via `wiki_task(promote)`. All fields required. |
| `task annotate` | ✅ | Via `wiki_task(annotate)` or direct `task <id> annotate` |
| `task done` | ✅ | Via `wiki_task(done)` or direct `task <id> done` |
| `task modify` core fields | ✅ | Only via `wiki_task(modify)` — validated, audit annotation auto-appended. Never raw `task modify`. |
| `task delete` | ⚠️ | Only via `wiki_task(delete)` with Walker's explicit per-task confirmation. Audit-logged to wiki events before deletion. |
| Un-complete a task | ❌ | Never |
| Modify identity fields (description, TYPE) | ❌ | Never. Close task and create new one instead. Project reassignment IS allowed via `wiki_task(modify)`. |
```

- [ ] **Step 2: Extend `session-workflow.md`**

Append these two sections at the end of the file:

````markdown
## Managing existing tasks (discuss a project or topic)

When Walker wants to adjust existing work:

```
1. Read state: task export project:<X>  (or by tag / scheduled range)
2. Discuss: what moves, what grows, what dies
3. Propose a change set — create / modify / done / delete, each with exact fields
4. Walker confirms — the whole set or item by item
5. Execute via wiki_task only:
   - modify → wiki_task(action: "modify", taskId, <fields>)
     validated; audit annotation auto-appended
   - delete → wiki_task(action: "delete", taskId, confirm: true)
     only after Walker's explicit per-task yes; audit-logged
6. Never run raw task modify / task delete yourself.
```

## Identity changes (rename / re-TYPE)

Description and TYPE are immutable. When scope truly changes:

```
1. wiki_task(done) the old task with a final annotation:
   "YYYY-MM-DD: Closed for scope change. Superseded by: <new topic>."
2. wiki_task(promote) the new task, carrying dependsOn from the old
   task's dependencies.
```
````

- [ ] **Step 3: Update `SKILL.md` triggers, tools, and rules**

In Triggers, add these three lines after `- "annotate task" / "add note to task"`:

```markdown
- "reschedule this" / "move X to Thursday" / "push this to next week"
- "drop this estimate" / "re-prioritize" / "reassign to project Y"
- "delete task N" / "remove this task"
```

In the Tools table, add these two rows after the `wiki_task(action: "done")` row:

```markdown
| `wiki_task(action: "modify")` | Validated field changes | `taskId` + fields (`scheduled`, `priority`, `estimate`, `due`, `project`, `addTags`, `removeTags`, `dependsOn`) |
| `wiki_task(action: "delete")` | Delete with audit log | `taskId`, `confirm: true` — Walker's approval required |
```

In Quick Reference **Always**, add after "- Chain split tasks with `depends:`":

```markdown
- Execute every write through `wiki_task` — never raw `task modify` / `task delete`
```

Replace the **Never** list:

```markdown
**Never:**
- Modify core fields without Walker's instruction
- Delete tasks
- Un-complete tasks
- Create unscheduled tasks
- Touch LIST.md — it is a plain inbox, not part of the task flow
```

with:

```markdown
**Never:**
- Modify or delete without Walker's confirmation
- Run raw `task modify` / `task delete` — always go through `wiki_task`
- Change a task's description or TYPE — close and recreate instead
- Un-complete tasks
- Create unscheduled tasks
- Touch LIST.md — it is a plain inbox, not part of the task flow
```

- [ ] **Step 4: Verify skill loading**

Run: `npm run check`
Expected: `pi-brain-wiki sanity check passed`.

- [ ] **Step 5: Commit**

```bash
git add skills/taskwarrior/
git commit -m "skill: taskwarrior documents full lifecycle — modify, delete, close+recreate"
```

---

## Self-Review Notes

- **Spec coverage:** modify handler + validator → Tasks 1-2; delete + audit → Task 2; event kind → Task 2; skill updates → Task 3; identity pattern → Task 3 Step 2. Untouched items (promote/annotate/done, WEEK.md, workshop, un-complete) have no tasks, per spec.
- **Type consistency:** `ModificationPayload` and error codes identical across Tasks 1-2; `handleWikiTaskAction(pi, params, root)` used identically in Task 2 Steps 2-3; `"task-delete"` spelled identically in types.ts, index.ts, and the delete handler.
- **Placeholder scan:** all code and prose blocks are complete and verbatim.
