# taskwarrior-workshop-redesign

## Status

active

## Current State

- All five plan tasks landed on main (commits 736215a..cdad634); final whole-branch review clean after one fix wave.
- Suite: 175 pass / 3 fail — the 3 failures are pre-existing on the base commit and unrelated (context-guards, project-sync ISO-week time bomb, context-gather-agent).
- `npm run check` passes.
- Live validation pending: one workshop session and one format-assist session in daily use.
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

- Walker: update the live vault template, then run one workshop session + one format-assist session. If both behave, mark this unit completed.
- Follow-up (separate unit): fix the 3 pre-existing red tests; regenerate repoWiki.
