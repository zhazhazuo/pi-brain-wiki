# Unresolved Issues — Design vs Implementation v2

> **Companion to:** `2026-05-08-wiki-position-and-role.md` + `addition-items-v1.md`
> **Date:** 2026-05-09
> **Status:** Open — these issues remain after codebase exploration

---

## 1. Core Contradiction: Wiki→PARA Flow

**Design claims:** *"Nothing moves from Wiki to PARA. They are parallel layers."*

**Design also shows:**
```
Wiki/ (drafting space)
    ↓  "only when user commits"
Project/ (active work)
    "Plan becomes a real project folder"
```

**Current code:** No automated path creates `Project/` from Wiki. But the design workflow draws a sequential arrow. The Workshop skill says *"propose JD placement to Walker; Walker commits."*

**Resolution needed:** Either (a) the principle is "agent never writes to PARA autonomously, but human may instantiate PARA content informed by Wiki synthesis," or (b) remove the arrow from the project planning workflow diagram.

---

## 2. No Wiki Digest / Daily Digest

**Design decision:** Single rolling `meta/wiki-digest.md`, regenerated after every agent turn. Replaces scanning all topic pages.

**Current code:** No digest file exists. `meta/index.md` is a static catalog. `meta/log.md` is human-readable event history. Agent uses `wiki_status` (counts only) or `wiki_scan_activity` (full filesystem scan of `Project/`, `Resource/`, `Draft/`).

**Consequence:** The "agent reads Wiki first" posture is broken. Intelligence agent has no pre-digested entry point and scans raw PARA every session.

**Implementation gap:**
- No digest generation in `indexer.ts` or `log.ts`
- No schema for digest content (stats, active discussions, stale items, recent events)
- No trigger to rebuild digest

---

## 3. No Discussion System

**Design decision:** `Wiki/discussions/route.md` indexes all discussions. Individual `YYYY-MM-DD-topic.md` briefing files. States: `ongoing | finish | archive | discord`. Agent reads route file at session start.

**Current code:** Zero implementation. No `discussions/` folder. No `route.md`. No briefing files. No session continuity mechanism.

**Consequence:** Every session starts cold. Agent cannot know "where we left off."

**Implementation gap:**
- No `discussions/` in vault structure
- No `wiki_discussion_start`, `wiki_discussion_update`, `wiki_discussion_finish` tools
- No session-start sequence that reads a route file
- Skills define manual startup checklists instead

---

## 4. Route File Scalability (Blocked on #3)

**Design shows:** Single `route.md` YAML file containing all discussions.

**Concern:** At 100+ discussions, this file becomes a parse bottleneck. Concurrent edits risk conflicts.

**Status:** Blocked — no point solving scalability for a file that doesn't exist yet. But if #3 is implemented, sharding strategy should be decided upfront (e.g., only keep `ongoing` in active route, archive `finish`/`archive` to an index).

---

## 5. Staleness / Sync Detection

**Design claims:** *"The agent should almost never need to scan raw PARA."*

**Current code:** `wiki_scan_activity` scans `Project/`, `Resource/`, and `Draft/` filesystem directly on every call. `wiki_sync` is a manual on-demand tool. No timestamp tracking when Wiki last synced with PARA.

**Consequence:** Agent has no way to know if Wiki content is stale relative to PARA.

**Implementation gap:**
- No `last_synced` field on wiki topic pages or in `meta/`
- No scheduled or event-driven sync trigger
- No lint rule that flags "Wiki topic older than PARA counterpart"
- `wiki_sync` tool description says *"Run with scope='all' after adding new PARA folders"* — entirely manual

---

## 6. Topic Lifecycle — Missing Auto-Triggers

**Design states:** `draft → integrated → consumed → archived → cleared`

**Current code:** Status field exists. Transitions can be made via `wiki_log_event` and `/wiki-consumed` command. Lint detects stale drafts and reactivated consumed pages.

**Missing:** What triggers promotion?
- `consumed` → `archived`: age-based? user command? agent heuristic?
- `archived` → `cleared`: grace period length? who decides?
- `integrated` awaiting recall: lint flags after 14 days, but no automated next step

**Consequence:** Wiki accumulates unbounded state. No cleanup runs automatically.

---

## 7. Draft/ Folder Position

**Design decision:** Move `Draft/` into `Wiki/drafts/`. *"Draft/ and inbox/ are both thinking space, not recorded truth."*

**Current code:** `Draft/` is still external PARA. `allowExternal` includes `../Draft/**`. `scanActivity` reads `Draft/` as vault activity. `config.ts` default paths do not include a `drafts` directory under Wiki.

**Consequence:** The zone map is muddy. Draft/ is external PARA but conceptually belongs to agent thinking space.

---

## 8. Obsidian Link Resolution for Agent

**Design assumes:** Agent can resolve `[[Area/CS/Type Systems]]` to read PARA content.

**Current code:** `normalizeWikiLinkTarget()` recognizes PARA links and does NOT flag them as broken in lint. `ObsidianClient` can query backlinks.

**Missing:** No tool or function that takes a wikilink like `[[Area/1 CS/Type Theory]]` and returns the absolute filesystem path for the agent to read. The agent must manually construct `../Area/1 CS/Type Theory.md`.

---

## 9. Session Start Sequence

**Design decision:** Agent reads `route.md → wiki-digest.md → LIST.md` before responding.

**Current code:** Skills define manual startup checklists (WIKI_SCHEMA → meta/index.md → LIST.md). No automated sequence. No discussion route to read.

**Consequence:** Agent orientation depends entirely on skill prompt discipline. No code-enforced session start protocol.

---

## 10. Drafts vs Plans Boundary

**Design:** `Wiki/drafts/` = mutable WIP. `Wiki/pages/plans/` = ready to become real.

**Current code:** No `Wiki/drafts/` exists. `pages/plans/` holds timeboxed plans. There is no distinction between "idea being refined" and "plan ready for execution."

---

## 11. wiki_sync Role Ambiguity

**Design:** `wiki_sync` is a **bootstrap** tool — run once to seed Wiki from PARA, then agent builds organically.

**Current code:** `wiki_sync` is a regular tool with no bootstrap semantics. Description says *"Run with scope='all' after adding new PARA folders"* — implying repeated use, not one-time.

**Consequence:** New PARA folders created after initial setup are invisible to Wiki unless someone manually re-runs `wiki_sync`.

---

## Summary Table

| # | Issue | Severity | Blocked By |
|---|-------|----------|------------|
| 1 | Wiki→PARA contradiction | Medium | Design decision |
| 2 | No wiki digest | **High** | — |
| 3 | No discussion system | **High** | — |
| 4 | Route file scalability | Low | #3 |
| 5 | Staleness / sync detection | **High** | #2 |
| 6 | Lifecycle auto-triggers | Medium | — |
| 7 | Draft/ folder position | Medium | Design decision |
| 8 | Obsidian link resolution | Medium | — |
| 9 | Session start sequence | Medium | #2, #3 |
| 10 | Drafts vs plans boundary | Low | #7 |
| 11 | wiki_sync bootstrap semantics | Low | Design decision |

---

## Recommended Priority Order

1. **#2 Wiki digest** — Biggest lever for "Wiki first, PARA on demand." Can be built from existing registry + events + lint + activity scan.
2. **#3 Discussion system** — Minimal viable: a `meta/discussions.md` index file + `wiki_log_event` integration to append to it. No new tools needed for MVP.
3. **#5 Staleness detection** — Add `last_synced` to topic frontmatter. Add lint rule comparing Wiki topic mtime to PARA folder mtime.
4. **#6 Lifecycle auto-triggers** — Define grace periods. Hook into digest generation or lint schedule.
5. **#1, #7, #11** — Require design decision, not implementation.
