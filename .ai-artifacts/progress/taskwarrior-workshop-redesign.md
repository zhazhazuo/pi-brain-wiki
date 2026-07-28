# taskwarrior-workshop-redesign

## Status

active

## Current State

- Redesign landed on main (commits 736215a..cdad634); final review clean.
- Full-lifecycle addendum landed on main (commits 4665c13..db13a7f): `wiki_task` modify (validated, audit-annotated) + delete (confirm-gated, audit-logged as `task-delete` events); skill documents discuss → propose → confirm → execute and close+recreate. Final review: ready to merge, zero Critical/Important.
- Suite: 182 pass / 3 fail — the 3 failures are pre-existing and unrelated.
- Live validation pending: one workshop session, one format-assist session, one project-discussion session with a modify/delete change set.
- Manual step pending for Walker: copy the new summary template into the live vault at `<vault>/Wiki/.wiki/templates/summary.md` (template body in `extensions/brain-wiki/src/scaffold.ts`).

## Key Decisions

- Taskwarrior: full decouple (option A). Remove task-sync, task-scan, `wiki_task_scan`, and both `syncCompletedTasksToList` calls. LIST.md stays a plain inbox.
- TW read path: direct read-only CLI (`task export` etc.) per skill convention — no new digest tool (deferred).
- Format assist is the only new TW feature; lint and work analysis deferred to daily experience.
- Workshop: Walker has read the source; agent reads it only for grounding. Plain-summary sections (Executive summary, Main claims, Important details, Entities) removed; new `## Core claim` (2–3 sentences) and `## Discussion` sections.
- Phase 4 becomes question-driven: agent asks 2–5 edge-focused questions after reading source + PKB.
- `wiki_integrate_source` validation unchanged (Bridge/edges/targets); Discussion enforcement deferred to skill level.

- Deferred triage rulings (final review): orphaned `ScanProposal` interface at types.ts:753 = accept, delete opportunistically; 3 pre-existing red tests = accept, track separately.

## Open Questions

- None blocking.

## Next

- Walker: update the live vault template, then run one workshop session + one format-assist session + one project-discussion session. If all behave, mark this unit completed.
- Follow-up (separate unit): fix the 3 pre-existing red tests; regenerate repoWiki; opportunistic hardening (unchecked audit-annotate result, merged status-tag integration test, `ScanProposal` orphan deletion).
