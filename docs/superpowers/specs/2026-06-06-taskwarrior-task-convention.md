# Taskwarrior Task Convention — SPEC

> **Scope:** All Taskwarrior tasks created or managed by agents.  
> **Status:** Draft → Final  
> **Owner:** Walker + Agent consensus

---

## 1. Description = Topic

The task **Description** names the **subject or domain**, not an action. It is the immutable identity of the task.

- **Noun-based:** "MEETING: Codex CLI Showcase with PIT Team" not "Book meeting for Codex showcase"
- **Immutable after creation:** Never modify the description. If the scope changes, close the task and create a new one.
- **Max 8 words after the TYPE prefix.**
- **No URLs, no IDs, no dates** in the description.

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| `MEETING: Codex CLI Showcase with PIT Team` | `Book meeting for Codex showcase` (imperative) |
| `Login Authentication System` | `Fix login bug` (action, not topic) |
| `FEAT: Voice Recording for FR&IT` | `Build voice recording feature` (imperative) |

---

## 2. TYPE Prefix

Every task starts with a TYPE prefix to signal intent and required deliverable.

| Prefix | Meaning | Typical Deliverable |
|--------|---------|-------------------|
| `MEETING:` | Synchronous human interaction | Meeting notes, decisions, follow-ups |
| `FEAT:` | Feature implementation | Working code, PR, deployed change |
| `RD:` | Research & discovery | Document, decision record, recommendation |
| `REVIEW:` | Code/design review | Approval, feedback log, action items |
| `SETUP:` | Environment/infrastructure setup | Working environment, configured tool |
| `PLAN:` | Architecture or project planning | Document, milestone map, task chain |
| `BUG:` | Bug fix or regression | Fix commit, test, deployed patch |
| `CONCEPT:` | Idea exploration | Document, prototype, feasibility assessment |

**Rules:**
- One prefix per task. No compound prefixes.
- The prefix is part of the immutable description.
- The prefix determines the default tag (see Section 5).

---

## 3. Annotations = Progress Log

Annotations are the **chronological trail** of the task. Every update, decision, status change, blocker, or follow-up becomes an annotation.

- **Append only.** Never delete or edit annotations.
- **Format:** `YYYY-MM-DD: <event description>`
- **Content:** Be concise. One sentence per event. Include decisions, blockers, completions of sub-work, and external references.

**Examples:**
```
2026-06-06: Meeting booked. Presentation prepared.
2026-06-08: Meeting done. Feedback: need live demo.
2026-06-09: Spawned subtask #10 "Live Demo for Codex Showcase" (dep:4)
2026-06-10: Blocked: waiting for PIT team calendar confirmation.
```

---

## 4. Dependencies = Subtask Spawning

When a topic spawns smaller actionable work, **create a new task with `depends:parentUUID`** rather than bloating the parent with action items.

- Subtask description follows the same topic rule (Section 1).
- Parent task stays **pending** until all children complete.
- Child tasks inherit the parent's project by default.
- Use `task <parent> modify depends:<child>` to link.

**Example chain:**
```
Task 4:  "MEETING: Codex CLI Showcase with PIT Team"
    └─ Task 10: "Live Demo for Codex Showcase" dep:4
    └─ Task 11: "Follow-up Email to PIT Team" dep:4
```

---

## 5. Tags = Status Markers

Tags are transient state indicators. They change as the task progresses.

| Tag | Meaning | When to Apply |
|-----|---------|---------------|
| `IN_PROGRESS` | Active work in this session | When task becomes current |
| `REVIEW` | Needs Walker's review or decision | When blocked on human input |
| `BLOCKED` | External dependency blocking work | When waiting on something outside agent control |
| `STALE` | No progress in >7 days | Auto-applied by scan; agent removes when work resumes |
| `DONE` | Completed (virtual) | Auto-set by `task done` |

**Rules:**
- Tags are lowercase in Taskwarrior but documented here in UPPER for clarity.
- A task should have at most one status tag at a time (`IN_PROGRESS`, `REVIEW`, `BLOCKED`).
- The `TYPE` prefix maps to a default category tag:
  - `MEETING:` → `meeting`
  - `FEAT:` → `feat`
  - `RD:` → `rd`
  - `REVIEW:` → `review`
  - `SETUP:` → `infra`
  - `PLAN:` → `plan`
  - `BUG:` → `bug`
  - `CONCEPT:` → `concept`

---

## 6. Task Metadata

| Field | Use | Rule |
|-------|-----|------|
| **Project** | Logical grouping | `Domain.SpecificOutcome` format. Concrete deliverable, not broad domain. |
| **Priority** | Urgency signal | `H` (high), `M` (medium), `L` (low). Agent suggests; Walker confirms. |
| **Due** | Hard deadline | Only if a real external deadline exists. |
| **Scheduled** | When it becomes actionable | **Always required.** No unscheduled tasks in Taskwarrior. |
| **Estimate** | Time budget | 0.5, 1, 1.5, 2, 2.5, or 3 days. Max 3 — split larger work. |
| **Tags** | Status + category | At least one category tag (Section 5). One status tag max. |

---

## 7. Immutable Fields

The following fields are **immutable after creation**:

- **Description** (including TYPE prefix)
- **Project**
- **UUID** (system-managed)

If any of these need to change, **close the task and create a new one**. Do not `task modify` on immutable fields.

---

## 8. Entry Criteria (When to Create a Task)

A task enters Taskwarrior when ALL of these are true:

1. **Committed work** — not a vague idea. If it's a vague idea, it stays in LIST.md.
2. **Has a TYPE prefix** — the agent or Walker knows what kind of deliverable is expected.
3. **Has a scheduled date** — the task is actionable on a specific date.
4. **Has a project** — the task belongs to a known deliverable.
5. **Has a priority** — the agent or Walker has assessed urgency.
6. **Has an estimate** — the work is bounded. If >3 days, it must be split.

**Never create unscheduled tasks.**

---

## 9. Exit Criteria (When to Complete a Task)

A task is marked `done` when:

1. **The topic is resolved.** The meeting happened, the feature is shipped, the research is documented.
2. **All child dependencies are complete.** Parent tasks do not close until children are done.
3. **Knowledge is captured.** For FEAT/RD/REVIEW tasks, the wiki topic page is updated with outcomes.
4. **Final annotation is added.** `YYYY-MM-DD: Completed. Outcome: <one sentence>.`

**Never un-complete a task.** If a task was closed in error, create a new one.

---

## 10. Split Rule

If estimate > 3 days, **split into chained sub-tasks with `depends:`**.

Present the chain to Walker:
> "RD → CONCEPT → FEAT → REVIEW. Each unblocks when previous completes. Want me to promote these?"

---

## 11. Bidirectional Linking

Every task that produces knowledge should link to a wiki topic.

**Task side:**
```bash
task <id> annotate "Wiki: [[topics/type-systems]]"
```

**Wiki topic side:** Add a `## Tasks` section:
```markdown
## Tasks
- [ ] #4 MEETING: Codex CLI Showcase with PIT Team (scheduled: Jun 8, estimate: 0.5)
```

Maintain both sides. When task completes, update the topic page with outcomes.

---

## 12. Agent vs. Human Rules

| Action | Agent | Human |
|--------|-------|-------|
| `task add` | ✅ Only via `wiki_task(promote)` | ✅ Direct CLI |
| `task annotate` | ✅ Via `wiki_task(annotate)` | ✅ Direct CLI |
| `task done` | ✅ Via `wiki_task(done)` | ✅ Direct CLI |
| `task modify` core fields | ❌ Never without explicit instruction | ✅ Direct CLI |
| `task delete` | ❌ Never | ✅ Direct CLI |
| `task modify` tags | ✅ For status transitions | ✅ Direct CLI |
| Un-complete a task | ❌ Never | ✅ Direct CLI |

---

## 13. Examples

### Example A: Meeting Task

```
Task: MEETING: Codex CLI Showcase with PIT Team
Project: AI.TeamCodingPattern
Priority: M
Scheduled: 2026-06-08
Due: 2026-06-08 19:00
Estimate: 0.5
Tags: meeting, REVIEW

Annotations:
  2026-06-06: Meeting booked. Presentation prepared.
  2026-06-08: Meeting done. Feedback: need live demo.
  2026-06-09: Spawned subtask #10 "Live Demo for Codex Showcase" (dep:4)
```

### Example B: Feature Task with Dependencies

```
Task: FEAT: Voice Recording for FR&IT
Project: SalesTool.VoiceRecording
Priority: M
Scheduled: 2026-06-15
Due: 2026-06-15
Estimate: 2
Tags: feat, IN_PROGRESS

Annotations:
  2026-06-10: Requirements clarified with FR&IT team.
  2026-06-11: Architecture approved. Starting implementation.
  2026-06-12: Spawned subtask #15 "Audio Compression Pipeline" (dep:3)
```

### Example C: Research Task

```
Task: RD: Learn Function Core + Imperative Shell
Project: Personal.CodingPattern
Priority: L
Scheduled: 2026-06-10
Estimate: 1
Tags: rd, IN_PROGRESS

Annotations:
  2026-06-10: Started reading "Grokking Simplicity".
  2026-06-11: Completed chapter 3. Key insight: separate calculation from action.
  2026-06-12: Wiki: [[topics/functional-core-imperative-shell]]
```

---

## 14. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Initial draft | Walker |
| 2026-06-06 | Added TYPE prefix table, status tags, bidirectional linking, split rule | Agent |
| 2026-06-06 | Renamed Task 4 to follow convention | Agent |

---

## 15. References

- `skills/taskwarrior/instructions/creation-rules.md` — Validation rules
- `skills/taskwarrior/instructions/session-workflow.md` — LIST.md draining, WEEK.md refresh
- `docs/ideas/taskwarrior-integration.md` — Integration design
