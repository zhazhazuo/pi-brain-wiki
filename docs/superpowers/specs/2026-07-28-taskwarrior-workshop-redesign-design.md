# Taskwarrior Decouple + Workshop Socratic Redesign — Design

**Date:** 2026-07-28
**Status:** Approved design, awaiting implementation plan

## Background

Two parts of pi-brain-wiki cause friction in daily use:

1. **Taskwarrior integration.** LIST.md and Taskwarrior are two independent
   systems glued together: promotion marks `[>]`, completion syncs back `[x]`.
   Walker wants the wiki to *read* Taskwarrior data to understand his real
   work and help him *format* new tasks — not to bind the two systems.
2. **wiki-workshop.** Walker has always read the source before a session.
   The agent's extraction and plain-content summary is wasted work. The
   value is understanding enhancement: connection to the PKB, the edges,
   and a Socratic discussion that deepens understanding and generates ideas.

## Part 1 — Taskwarrior: decoupled read + format assist

### Architecture

One direction only. Taskwarrior is a read-only data source plus a validated
write endpoint. LIST.md has no connection to it.

```
task export (read-only) ──► agent context: real projects, tags, estimates
Walker describes work   ──► agent drafts task per creation-rules
Walker confirms         ──► wiki_task(promote) ──► task add
```

### Remove

- `extensions/brain-wiki/src/task-sync.ts` and `task-sync.test.ts` — the
  `[>]` / `[x]` LIST.md binding.
- `extensions/brain-wiki/src/task-scan.ts` and `task-scan.test.ts` — its
  purpose was promotion proposals. No promotion flow, no scan.
- `wiki_task_scan` tool registration in `extensions/brain-wiki/index.ts`,
  including the `scanVaultForTasks` import.
- Both `syncCompletedTasksToList` calls in `index.ts` (the `wiki_task_scan`
  handler and the `wiki_week` handler) and the `task-sync.ts` import.
- LIST.md draining protocol and bidirectional-linking rules from the
  taskwarrior skill.

### Keep unchanged

- `task-cli.ts`, `task-validator.ts`, `instructions/creation-rules.md` —
  the formatting knowledge is the asset.
- `wiki_task` (promote / annotate / done) — validated writes still happen,
  but only from a confirmed draft, never from a LIST.md item.
- `wiki_week` — WEEK.md dashboard stays; it is already read-only after the
  sync call is removed.

### New (skill only, no new extension tools)

- `skills/taskwarrior/SKILL.md` rewritten: triggers become format assist
  ("make this a task", "help me phrase this task"), weekly view, annotate,
  done. Scan/drain triggers removed. Tool table loses `wiki_task_scan`.
- `skills/taskwarrior/instructions/session-workflow.md` rewritten around
  one loop: **read state → draft → confirm → add**:
  1. Before drafting, gather context with read-only CLI (`task export`,
     `task projects`, `task tags`) so drafts reuse Walker's real
     `Domain.Outcome` projects and tag vocabulary instead of inventing them.
  2. Draft the task per creation-rules and present it.
  3. On confirmation, `wiki_task(promote)`.
  No LIST.md steps anywhere.
- `skills/brain-wiki/SKILL.md` tool table: remove the `wiki_task_scan` row;
  update the `wiki_task` row wording.

### Deferred (grow later from daily experience)

- Lint of existing tasks against the convention.
- Work analysis (completed/stale/estimate patterns) feeding the
  Intelligence agent's reviews.
- A dedicated digest tool for TW state — only if direct read-only CLI
  proves clumsy in practice.

## Part 2 — Workshop: from summarizer to thinking partner

### Core shift

Walker has read the source. The agent reads it only for grounding, reads
the PKB for connection, then **asks Walker questions**. The summary page
becomes a learning record, not a content summary.

### Protocol changes (ingest mode)

| Phase | Today | New |
|-------|-------|-----|
| 1 Receive | Capture + extract + report content back to Walker | Capture stays (agent needs grounding). Report-back removed. Weight classification stays |
| 2 Orient | wiki/graph search | Unchanged |
| 3 Platform | Teach Walker the content + present full platform | 3.1 "explain" becomes internal grounding, not teaching. Platform is compressed; its job is to prepare questions, not to present |
| 4 Discuss | Agent presents takeaways, Walker confirms | **Replaced by "Questions & Brainstorm"**: agent asks 2–5 probing questions aimed at the edge — tensions with the PKB, applications, implications for Walker's projects, what struck him. Answers refine the Bridge and generate ideas |
| 5 Write | Summary + Bridge + edges + targets | Bridge + edges + targets stay. Plain-summary sections shrink. New `## Discussion` section: questions asked, Walker's compressed answers, ideas generated |

### Summary template changes (`extensions/brain-wiki/src/scaffold.ts`)

New section order for the summary page:

1. `## Source at a glance` — metadata, unchanged
2. `## Core claim` — **new**, 2–3 sentences max, so the page stays
   self-describing
3. `## Bridge` — unchanged, still the primary artifact
4. `## Discussion` — **new**, the Q&A record and ideas
5. `## Reliability / caveats` — unchanged
6. `## Integration targets` — unchanged
7. `## Edges` — unchanged
8. `## Open questions` — unchanged

Removed: `## Executive summary`, `## Main claims`,
`## Important details and data points`, `## Entities and concepts mentioned`.

Any tests or validation referencing removed sections are updated.
`wiki_integrate_source` tool-level validation is **not** changed — it keeps
requiring Bridge, edges frontmatter, and integration targets. Requiring
`## Discussion` at tool level is deferred (skill-level rule first).

Existing summary pages are untouched; the template change affects only new
captures.

### Skill file updates

- `instructions/protocol.md` — Phase 1, 3, 4, 5 rewritten per the table above.
- `instructions/platform.md` — 3.1 reframed as internal grounding; add
  question-generation guidance (what makes a good edge question).
- `SKILL.md` — quick reference and never-list updated (discussion phase is
  now question-driven; skipping it is still forbidden).
- `instructions/rules.md` — rule 2 and rule 8 wording: plain-summary
  obligation removed; summary length target reduced.
- `instructions/checklist.md` — updated to the new phase shape.
- `README.md` — page-model table row for `summary` updated to the new
  section list.

### Unchanged

PKB mini-search hard gate, edges frontmatter, graduation mode,
refinement-without-source mode, all supervision rules, contradiction
handling.

## Out of scope

- repoWiki regeneration (run after implementation lands).
- Task linting, TW work analysis, digest tool (deferred above).
- Tool-level enforcement of `## Discussion`.
- LIST.md itself — it stays a plain capture inbox; `wiki_triage` is
  untouched.

## Testing

- Remove `task-sync.test.ts`, `task-scan.test.ts`.
- Update `scaffold` / `capture` / integration tests that reference removed
  template sections or the removed tools.
- `npm run check` must pass.
- Skill files are prose; verification is a read-through of the rewritten
  protocol plus one live workshop session and one live format-assist
  session after implementation.
