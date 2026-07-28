# Task Creation Rules

> **Full convention:** `docs/superpowers/specs/2026-06-06-taskwarrior-task-convention.md`

Every promoted task must pass ALL of these:

| Field | Rule |
|-------|------|
| **Project** | `Domain.SpecificOutcome` format (e.g. `AI.TypeSystems-Research`). Concrete deliverable, not broad domain. |
| **Description** | `TYPE: Short topic` — max 8 words after prefix. Noun-based, names subject/domain, not action. Immutable after creation. |
| **TYPE prefix** | One of: `BUG:` `FEAT:` `RD:` `REVIEW:` `SETUP:` `PLAN:` `MEETING:` |
| **Priority** | `IU`→`H`, `I`→`M`, `U`→`L`. Agent suggests; Walker confirms. |
| **Estimate** | 0.5, 1, 1.5, 2, 2.5, or 3 days. Max 3 — split larger work. |
| **Scheduled** | Always required. No unscheduled tasks. |
| **Due** | Only if real deadline exists. |
| **Tags** | Category tag (from TYPE prefix) + optional status tag (`IN_PROGRESS`, `REVIEW`, `BLOCKED`). Max one status tag. |

## Topic Naming Convention

The description is the **immutable identity** of the task. It names the subject, not an action.

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| `MEETING: Codex CLI Showcase with PIT Team` | `Book meeting for Codex showcase` (imperative) |
| `Login Authentication System` | `Fix login bug` (action, not topic) |
| `FEAT: Voice Recording for FR&IT` | `Build voice recording feature` (imperative) |

**Rules:**
- Noun-based, not verb-based.
- No URLs, no IDs, no dates in the description.
- If the scope changes, close the task and create a new one — do not modify the description.

## TYPE Prefix → Tag Mapping

| Prefix | Default Tag | Meaning |
|--------|-------------|---------|
| `MEETING:` | `meeting` | Synchronous human interaction |
| `FEAT:` | `feat` | Feature implementation |
| `RD:` | `rd` | Research & discovery |
| `REVIEW:` | `review` | Code/design review |
| `SETUP:` | `infra` | Environment/infrastructure setup |
| `PLAN:` | `plan` | Architecture or project planning |
| `BUG:` | `bug` | Bug fix or regression |
| `CONCEPT:` | `concept` | Idea exploration |

**Status tags** (max one per task): `IN_PROGRESS`, `REVIEW`, `BLOCKED`, `STALE`

## Split Rule

If estimate > 3 days, split into chained sub-tasks with `depends:`. Present the chain to Walker:
> "RD → CONCEPT → FEAT → REVIEW. Each unblocks when previous completes. Want me to promote these?"

## Dependencies = Subtask Spawning

When a topic spawns smaller actionable work, create a new task with `depends:parentUUID` rather than bloating the parent with action items.

- Subtask description follows the same topic rule (Section 1).
- Parent task stays pending until all children complete.
- Child tasks inherit the parent's project by default.

## Annotations = Progress Log

Annotations are the chronological trail of the task. Every update, decision, status change, blocker, or follow-up becomes an annotation.

- Append only. Never delete or edit annotations.
- Format: `YYYY-MM-DD: <event description>`
- Content: Be concise. One sentence per event.
- Include: decisions, blockers, completions of sub-work, external references, spawned subtasks.

## Entry Criteria (When to Create a Task)

A task enters Taskwarrior when ALL of these are true:

1. **Committed work** — not a vague idea. If it's a vague idea, it stays in LIST.md.
2. **Has a TYPE prefix** — the agent or Walker knows what kind of deliverable is expected.
3. **Has a scheduled date** — the task is actionable on a specific date.
4. **Has a project** — the task belongs to a known deliverable.
5. **Has a priority** — the agent or Walker has assessed urgency.
6. **Has an estimate** — the work is bounded. If >3 days, it must be split.

## Exit Criteria (When to Complete a Task)

A task is marked `done` when:

1. **The topic is resolved.** The meeting happened, the feature is shipped, the research is documented.
2. **All child dependencies are complete.** Parent tasks do not close until children are done.
3. **Knowledge is captured.** For FEAT/RD/REVIEW tasks, the wiki topic page is updated with outcomes.
4. **Final annotation is added.** `YYYY-MM-DD: Completed. Outcome: <one sentence>.`

## Agent Write Rules

| Action | Allowed? | How |
|--------|----------|-----|
| `task add` | ✅ | Only via `wiki_task(promote)`. All fields required. |
| `task annotate` | ✅ | Via `wiki_task(annotate)` or direct `task <id> annotate` |
| `task done` | ✅ | Via `wiki_task(done)` or direct `task <id> done` |
| `task modify` core fields | ✅ | Only via `wiki_task(modify)` — validated, audit annotation auto-appended. Never raw `task modify`. |
| `task delete` | ⚠️ | Only via `wiki_task(delete)` with Walker's explicit per-task confirmation. Audit-logged to wiki events before deletion. |
| Un-complete a task | ❌ | Never |
| Modify identity fields (description, TYPE) | ❌ | Never. Close task and create new one instead. Project reassignment IS allowed via `wiki_task(modify)`. |
