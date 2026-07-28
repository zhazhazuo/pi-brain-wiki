# Taskwarrior Full-Lifecycle Management — Design Addendum

**Date:** 2026-07-28
**Status:** Approved design, awaiting implementation plan
**Extends:** `2026-07-28-taskwarrior-workshop-redesign-design.md`

## Background

After the decouple, the agent can discuss a project or topic's tasks
(read-only), create from a confirmed draft, annotate, and complete. Daily
planning needs more: reschedule, re-estimate, re-prioritize, reassign
projects, and occasionally delete. Walker grants the assistant **full task
access**, but every write must go through the validated script layer —
never raw CLI — so format and pattern are guaranteed.

## Approved decisions

- **Full modify scope (D):** scheduled, priority, estimate, due, recur,
  depends, project reassignment, tag add/remove.
- **Identity immutable (2a-A):** description/TYPE changes are refused. The
  pattern is close + recreate (`done` with final annotation, then
  `promote` with `depends:` carried over).
- **Delete allowed (2b-B):** through the script only, with Walker's
  explicit per-task confirmation, audit-logged before deletion.
- **Un-complete stays forbidden.** Done is final.

## Extension changes

### `wiki_task` gains two actions

**`modify`:**

1. Requires `taskId`. If `description` is present in the call, refuse:
   "Description/TYPE is immutable identity — close and recreate instead."
2. Builds a `ModificationPayload` and runs a new
   `validateModification()` in `task-validator.ts`:
   - at least one modifiable field present
   - `project` (if present) matches `Domain.SpecificOutcome`
   - `priority` (if present) maps IU/I/U → H/M/L (same param convention
     as promote)
   - `estimate` (if present) ∈ {0.5, 1, 1.5, 2, 2.5, 3}
   - `addTags` (if present) contains at most one status tag
     (`IN_PROGRESS`, `REVIEW`, `BLOCKED`, `STALE`)
   - merged tag set (existing − removeTags + addTags) has at most one
     status tag — checked in the handler against the exported task
3. Executes `task <id> modify k:v ...` (`+tag` / `-tag` for tags,
   `depends:uuid1,uuid2` for dependencies).
4. On success, auto-appends one audit annotation:
   `YYYY-MM-DD: modified scheduled: 2026-07-28 → 2026-07-30; estimate: 2 → 1`
   (old values read from the exported task record before the modify).

**`delete`:**

1. Requires `taskId` and `confirm: true`. Without `confirm`, refuses and
   tells the agent to get Walker's explicit confirmation first.
2. Exports the task's JSON record, then runs
   `task rc.confirmation=off <id> delete`.
3. Appends the deleted record to the wiki event log via `appendEvent`
   with `kind: "task-delete"`, title `Deleted task <id>: <description>`,
   and notes carrying project, scheduled, priority, estimate, tags. The
   audit survives the deletion.

### Plumbing

- `EVENT_KIND_ENUM` (index.ts) and `WikiEventKind` (types.ts) gain
  `"task-delete"`.
- `ModificationPayload` type added to `types.ts`.
- `handleWikiTaskAction` regains the `root` parameter
  (`handleWikiTaskAction(pi, params, root)`) — `delete` needs it for
  `appendEvent`.
- Tool registration: action enum becomes
  `["promote", "annotate", "done", "modify", "delete"]`; new optional
  params `addTags`, `removeTags` (string arrays) and `confirm` (boolean);
  promptGuidelines updated: propose change sets, confirm with Walker,
  then execute.

## Skill changes (taskwarrior)

- `creation-rules.md` — Agent Write Rules table: `task modify` core
  fields becomes ✅ only via `wiki_task(modify)` (validated;
  description/TYPE immutable); `task delete` becomes ✅ only via
  `wiki_task(delete)` with Walker's explicit confirmation, audit-logged.
- `session-workflow.md` — the loop extends to: **discuss project/topic →
  read state → propose change set (create / modify / done / delete) →
  confirm → execute**. Adds the identity-change pattern (close +
  recreate with `depends:` carried over).
- `SKILL.md` — new triggers ("reschedule this", "move X to Thursday",
  "drop this estimate", "reassign to project Y", "delete task N") and
  tool-table rows for modify/delete.

## Tests

TDD on `validateModification`: valid minimal payload, valid full payload,
empty modification rejected, invalid project / priority / estimate
rejected, more-than-one status tag in addTags rejected. Existing suite
must stay green (3 pre-existing unrelated failures are known and out of
scope).

## Untouched

promote/annotate/done logic, WEEK.md, workshop skill, LIST.md, un-complete
prohibition.
