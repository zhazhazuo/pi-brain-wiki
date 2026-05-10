# Implementation Plan: Wiki Position v3

> **Based on:** `2026-05-09-wiki-position-and-role-v3.md`
> **Date:** 2026-05-09
> **Status:** Ready for execution

---

## Overview

Implement the Wiki/PARA parallel-layer architecture from the v3 design doc. This is a 9-task vertical slice delivering:

1. **Foundation:** New vault folders (`discussions/`, `drafts/`) + Draft/ migration
2. **Core features:** Wiki digest (agent entry point) + Discussion system (session continuity)
3. **Polish:** Staleness detection, link resolution, lifecycle grace periods, skill updates

The critical path is Task 1 → Task 2 → Task 3. Everything else branches from there.

---

## Architecture Decisions

- **On-change rebuild:** Wiki digest rebuilds only when `dirtyRoots` is set (same pattern as registry). Avoids per-turn cost.
- **Files-only discussions:** No new tools for MVP. Agent uses existing `read`/`write`/`edit` on markdown. Tools come later if the pattern proves useful.
- **Hardcoded grace periods:** Constants in `lifecycle.ts`. Configurable later if requested.
- **Single "below minimum" metric:** Word count < 100. Simple, debuggable, sufficient.
- **Frontmatter + markdown for route.md:** Reuses `parsePage()`/`writePage()` (gray-matter). Fallback to JSON + generated markdown if editing proves fragile.

---

## Task List

### Phase 1: Foundation

#### Task 1: Bootstrap `discussions/` and `drafts/` folders

**Description:** Add `Wiki/discussions/` and `Wiki/drafts/` to `bootstrapVault()`. Seed `discussions/route.md` with empty structure so the agent can read it at session start without null-checks.

**Acceptance criteria:**
- [ ] `bootstrapVault()` creates `discussions/` and `drafts/` directories
- [ ] `bootstrapVault()` creates `discussions/route.md` with empty Active/Recent/Archive sections
- [ ] Existing tests pass; no regression in scaffold behavior

**Verification:**
- [ ] `npm run check` passes
- [ ] Manual: bootstrap a new vault, verify folders exist

**Dependencies:** None

**Files touched:**
- `extensions/brain-wiki/src/scaffold.ts`

**Estimated scope:** XS (1 file, 1 function)

---

#### Task 2: Draft/ migration Phase 1

**Description:** Update code to use `Wiki/drafts/` as the canonical drafts location. Keep external `Draft/` in `allowExternal` temporarily for backward compatibility. Update `activity.ts` to scan `Wiki/drafts/` instead of external `Draft/`.

**Acceptance criteria:**
- [ ] `activity.ts` scans `Wiki/drafts/` for changes
- [ ] `paths.ts` has `draftsDir()` helper returning `join(root, "drafts")`
- [ ] `allowExternal` still includes `../Draft/**` (no breaking change yet)
- [ ] `scanActivity` reports `Wiki/drafts/` changes under vault activity

**Verification:**
- [ ] `npm run check` passes
- [ ] Manual: create a file in `Wiki/drafts/`, run `wiki_scan_activity`, verify it appears

**Dependencies:** Task 1

**Files touched:**
- `extensions/brain-wiki/src/paths.ts`
- `extensions/brain-wiki/src/activity.ts`

**Estimated scope:** S (2 files)

---

### Checkpoint: Foundation

- [ ] All tests pass
- [ ] Build succeeds
- [ ] New vault has `discussions/` and `drafts/`
- [ ] `wiki_scan_activity` sees `Wiki/drafts/` changes

---

### Phase 2: Core Features

#### Task 3: Wiki digest — `buildDigest()` + rebuild pipeline

**Description:** Implement `buildDigest(root)` that reads `registry.json`, `events.jsonl`, and runs a lightweight lint pass to produce `meta/wiki-digest.md`. Hook into `rebuildAllGeneratedArtifacts()` in `index.ts`. Use `dirtyRoots` pattern — only rebuild when state changed.

**Digest content:**
```markdown
# Wiki Digest

## Stats
- Topics: N | Summaries: N | Plans: N | Reviews: N
- Sources: N captured, N integrated, N consumed

## Active Discussions
(none or list from route.md)

## Recent Events (last 7d)
- YYYY-MM-DD kind: title

## Needs Attention
- topic-name: N words (below minimum)
- topic-name: no activity in Nd

## Stale
- source-name: integrated Nd, not consumed
```

**Acceptance criteria:**
- [ ] `buildDigest()` reads registry, events, and computes stats
- [ ] `buildDigest()` flags topics with `wordCount < 100` as below minimum
- [ ] `buildDigest()` lists recent events (last 7 days)
- [ ] `rebuildAllGeneratedArtifacts()` calls `buildDigest()` and returns digest path
- [ ] Digest is written to `meta/wiki-digest.md`

**Verification:**
- [ ] `npm run check` passes
- [ ] Manual: create/update a wiki page, end session, verify `meta/wiki-digest.md` exists and reflects changes

**Dependencies:** Task 1

**Files touched:**
- `extensions/brain-wiki/src/log.ts` or new `extensions/brain-wiki/src/digest.ts`
- `extensions/brain-wiki/index.ts` (hook into `rebuildAllGeneratedArtifacts()`)

**Estimated scope:** M (3-4 files)

---

#### Task 4: Discussion system MVP — `route.md` + briefing files

**Description:** Add skill instructions for the discussion system. No new code tools — agent uses existing file operations. The skill tells the agent to:

1. Read `discussions/route.md` at session start
2. Create briefing files (`discussions/YYYY-MM-DD-topic.md`) during discussions
3. Update route.md with frontmatter (active discussions list)

**Acceptance criteria:**
- [ ] `brain-wiki` SKILL.md updated with discussion system instructions
- [ ] `wiki-map` SKILL.md startup checklist includes `discussions/route.md`
- [ ] `wiki-workshop` SKILL.md includes discussion recording step
- [ ] `wiki-intel` SKILL.md startup checklist includes `discussions/route.md`

**Verification:**
- [ ] Manual: start a session, verify agent reads route.md if it exists
- [ ] Manual: agent creates briefing file and updates route.md during discussion

**Dependencies:** Task 1

**Files touched:**
- `extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md`
- `extensions/brain-wiki/resources/skills/wiki-map/SKILL.md`
- `extensions/brain-wiki/resources/skills/wiki-workshop/SKILL.md`
- `extensions/brain-wiki/resources/skills/wiki-intel/SKILL.md`

**Estimated scope:** M (4 files, skill writing)

---

### Checkpoint: Core Features

- [ ] Digest auto-rebuilds on change and contains accurate stats
- [ ] Agent reads route.md at session start
- [ ] Agent can create briefing files and update route.md
- [ ] All tests pass

---

### Phase 3: Polish

#### Task 5: Staleness detection — `last_synced` + lint rule

**Description:** Add `last_synced` and `para_source` to topic frontmatter during `wiki_sync`. Add a lint rule that compares `last_synced` to PARA folder mtime and flags stale topics.

**Acceptance criteria:**
- [ ] `wiki_sync` writes `last_synced` (current date) and `para_source` (PARA path) to topic frontmatter
- [ ] `wiki_sync` writes `meta/sync-state.json` with `last_full_sync` timestamp
- [ ] Lint staleness mode flags topics where PARA folder mtime > `last_synced`
- [ ] Lint message format: `"topics/X.md may be stale — Resource/Y modified YYYY-MM-DD"`

**Verification:**
- [ ] `npm run check` passes
- [ ] Manual: run `wiki_sync`, verify `last_synced` appears in topic frontmatter
- [ ] Manual: modify a PARA folder, run `wiki_lint`, verify stale flag

**Dependencies:** Task 3 (digest exists to consume lint output)

**Files touched:**
- `extensions/brain-wiki/src/sync.ts`
- `extensions/brain-wiki/src/lint.ts`

**Estimated scope:** M (2-3 files)

---

#### Task 6: Link resolution — `resolveWikiLink()` utility

**Description:** Add `resolveWikiLink(wikiRoot, link)` to `paths.ts` that resolves wikilinks to absolute filesystem paths. Handles both PARA links (`Area/`, `Project/`, `Resource/`) and Wiki links (`topics/`, `summaries/`, `plans/`, `reviews/`).

**Acceptance criteria:**
- [ ] `resolveWikiLink("/vault/Wiki", "[[Area/1 CS/Type Theory]]")` returns absolute path to Area file
- [ ] `resolveWikiLink("/vault/Wiki", "[[topics/functional-programming]]")` returns absolute path to Wiki topic
- [ ] Returns `null` for unresolvable links
- [ ] Unit tests cover PARA and Wiki link cases

**Verification:**
- [ ] `npm run check` passes
- [ ] New tests pass

**Dependencies:** None

**Files touched:**
- `extensions/brain-wiki/src/paths.ts`
- `extensions/brain-wiki/src/paths.test.ts` (new or existing)

**Estimated scope:** S (1-2 files)

---

#### Task 7: Lifecycle grace periods — formalize in lint

**Description:** Add hardcoded grace period constants to a new `lifecycle.ts` module. Update existing `lintStaleness()` in `lint.ts` and `computeLifecycleBacklog()` in `activity.ts` to use these constants. Ensure lint flags match the grace periods defined in v3.

**Grace periods:**
```typescript
const GRACE_PERIODS = {
  integrated_to_consumed: 14,
  consumed_to_archived: 30,
  archived_to_cleared: 60,
  draft_stale: 30,
};
```

**Acceptance criteria:**
- [ ] New `src/lifecycle.ts` exports `GRACE_PERIODS`
- [ ] `lintStaleness()` uses `GRACE_PERIODS.draft_stale` instead of hardcoded `30`
- [ ] `computeLifecycleBacklog()` uses `GRACE_PERIODS.integrated_to_consumed` instead of hardcoded `14`
- [ ] All existing lint tests pass

**Verification:**
- [ ] `npm run check` passes
- [ ] Manual: verify lint flags a draft older than 30 days

**Dependencies:** Task 3 (digest displays lint output)

**Files touched:**
- `extensions/brain-wiki/src/lifecycle.ts` (new)
- `extensions/brain-wiki/src/lint.ts`
- `extensions/brain-wiki/src/activity.ts`

**Estimated scope:** S (2-3 files)

---

#### Task 8: Session start — update skills

**Description:** Update all four skill files to include the session start sequence: read `discussions/route.md`, then `meta/wiki-digest.md`, then `LIST.md`.

**Acceptance criteria:**
- [ ] `brain-wiki` SKILL.md defines the 3-step session start sequence
- [ ] `wiki-map` SKILL.md startup checklist includes route.md and digest
- [ ] `wiki-workshop` SKILL.md startup checklist includes route.md and digest
- [ ] `wiki-intel` SKILL.md startup checklist includes route.md and digest

**Verification:**
- [ ] Manual: verify skills mention the sequence

**Dependencies:** Task 3, Task 4

**Files touched:**
- `extensions/brain-wiki/resources/skills/brain-wiki/SKILL.md`
- `extensions/brain-wiki/resources/skills/wiki-map/SKILL.md`
- `extensions/brain-wiki/resources/skills/wiki-workshop/SKILL.md`
- `extensions/brain-wiki/resources/skills/wiki-intel/SKILL.md`

**Estimated scope:** S (4 files, text edits)

---

#### Task 9: `wiki_sync` bootstrap semantics

**Description:** Update `wiki_sync` tool description to clarify it's a bootstrap tool, not continuous sync. Add `meta/sync-state.json` tracking. Add lint rule suggesting re-sync if `last_full_sync` > 30 days and PARA has new folders.

**Acceptance criteria:**
- [ ] `wiki_sync` tool description updated: "Seed Wiki topic pages from PARA structure. Run once during setup..."
- [ ] `meta/sync-state.json` created/updated on `wiki_sync` run
- [ ] Lint rule suggests re-running `wiki_sync` if stale (>30 days + new PARA folders)

**Verification:**
- [ ] `npm run check` passes
- [ ] Manual: run `wiki_sync`, verify `meta/sync-state.json` exists

**Dependencies:** Task 5

**Files touched:**
- `extensions/brain-wiki/index.ts` (tool description)
- `extensions/brain-wiki/src/sync.ts`
- `extensions/brain-wiki/src/lint.ts`

**Estimated scope:** S (2-3 files)

---

### Checkpoint: Complete

- [ ] All tests pass
- [ ] Build succeeds
- [ ] New vault bootstraps with `discussions/` and `drafts/`
- [ ] Digest rebuilds on change and contains stats, events, stale items
- [ ] Agent reads route.md and digest at session start
- [ ] Staleness detection flags outdated topics
- [ ] Link resolution resolves PARA and Wiki links
- [ ] Grace periods formalized in lint
- [ ] `wiki_sync` behaves as bootstrap tool
- [ ] Ready for review

---

## Dependency Graph

```
Task 1: Bootstrap folders
    │
    ├──► Task 2: Draft/ migration
    │
    ├──► Task 3: Wiki digest ◄──────┐
    │       │                        │
    │       ├──► Task 5: Staleness   │
    │       │       │                │
    │       │       └──► Task 9:     │
    │       │           wiki_sync    │
    │       │                        │
    │       └──► Task 7: Grace       │
    │               periods          │
    │                                │
    ├──► Task 4: Discussion system   │
    │       │                        │
    │       └──► Task 8: Session     │
    │               start            │
    │                                │
    └──► Task 6: Link resolution ────┘
            (independent)
```

**Critical path:** 1 → 2 → 3 → (5, 7, 8, 9)
**Parallel work:**
- Task 6 (link resolution) can happen anytime
- Task 4 (discussions) and Task 3 (digest) can be worked in parallel after Task 1

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Digest rebuild is slow for large vaults | Medium | On-change only (dirtyRoots). If still slow, add caching or incremental update. |
| Agent edits route.md unreliably | Medium | Frontmatter + markdown is simple. If fragile, switch to JSON + generated markdown. |
| mtime comparison gives false positives (sync services) | Low | Document as best-effort. Use content hash in v2 if needed. |
| Draft/ migration breaks existing vaults | Medium | Phased deprecation (3 releases). Phase 1 is backward-compatible. |
| Grace periods don't match user workflow | Low | Hardcoded for MVP. Easy to make configurable later. |

---

## Open Questions

1. **Should the digest include a "Recent captures" section** listing unintegrated sources? (Likely yes — add to Task 3.)
2. **Should `wiki_sync` be auto-triggered** when new PARA folders are detected? (Likely no — keep it manual per v3 design.)
3. **Should discussion briefing files be protected** from agent edits after state = archive? (Likely no — agent can still read.)
