# Wiki Position and Role in the PARA Vault

> **Draft v3** — 2026-05-09
> **Status:** Ready for implementation
> **Context:** How Wiki/ relates to PARA/, what Wiki/ is for, and how the agent should use it.
> **Companion docs:** `addition-items-v1.md`, `addition-items-v2.md`, `addition-items-v3.md`, `issue-v2.md`, `issue-v3.md`

---

## The Mental Model

PARA + Wiki + LIST.md. Three distinct zones in one vault.

Wiki is the **agent-oriented parallel layer** to PARA. It's not a staging area that feeds into PARA — it's a thinking space that **references** PARA. The agent works in Wiki, the human curates PARA. They coexist.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   TALKING                    WIKI                        PARA       │
│   (conversation)        (agent-oriented)          (human-curated)   │
│                                                                     │
│   User + Agent          Parallel layer            Permanent store   │
│   discussing,           that references PARA       where:           │
│   questioning,          and synthesizes:           • finalized       │
│   exploring                                           knowledge     │
│                        • captures sources          • projects        │
│                        • records discussions         with status     │
│                        • drafts plans              • PKB entries     │
│                        • builds wiki-style           (Area/)         │
│                          descriptions of PARA      • raw refs        │
│                        • maintains wiki digest       (Resource/)     │
│                                                                     │
│   ◄──── user talks ────► ◄── agent works ──────► ◄── human ──►     │
│                           in this space               curates       │
│                                                                     │
│                        Wiki references PARA via Obsidian links      │
│                        Knowledge does not automatically flow        │
│                        from Wiki to PARA                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key principle:** Wiki is where thinking happens. PARA is where conclusions live. Wiki references PARA. Knowledge does not automatically flow from Wiki to PARA — but human curation decisions may create PARA content informed by Wiki synthesis. They are parallel layers, not a pipeline.

**Corollary:** The agent **never autonomously writes to PARA**. It proposes; the human decides. The agent executes only what the human authorizes.

---

## Vault Structure

```
Brain/                    ← vault root
├── Area/                 ← PARA: PKB (human-only)
│   ├── 0 Me/
│   ├── 1 CS/
│   └── 2 Business/
├── Project/              ← PARA: active work (shared)
├── Resource/             ← PARA: raw references (read-only for agent)
├── Archive/              ← PARA: retired (read-only)
├── LIST.md               ← routing center (shared)
└── Wiki/                 ← thinking space (agent-owned)
    ├── .wiki/config.json
    ├── inbox/            ← captured sources (immutable packets)
    ├── drafts/           ← ideas, WIP, half-formed plans (mutable)
    ├── discussions/      ← discussion records
    │   ├── route.md      ← index of all discussions
    │   └── YYYY-MM-DD-topic.md  ← individual briefings
    ├── pages/
    │   ├── topics/       ← knowledge synthesis + PARA indexes
    │   ├── summaries/    ← captured source notes
    │   ├── plans/        ← project drafts (ready to become real)
    │   └── reviews/      ← periodic analysis
    └── meta/             ← auto-generated (registry, backlinks, events, digest)
```

### Why Draft/ lives inside Wiki/

Draft/ and inbox/ are both thinking space, not recorded truth:

| | inbox/ | drafts/ |
|---|---|---|
| Content | Captured sources | Mutable work-in-progress |
| Created by | Agent (auto on capture) | Agent or user (when thinking) |
| Lifecycle | Source → summary → consumed | Idea → plan → project (or discarded) |
| Mutability | Never edited after capture | Edited, iterated, refined |

Moving Draft/ into Wiki/ simplifies the zone map:
- **Wiki/** — agent-owned (thinking + synthesis)
- **PARA/** — human-curated (recorded truth)
- **LIST.md** — genuinely shared routing center (the one exception)

### Zone Ownership

| Zone | Path | Owner | Agent Can |
|------|------|-------|-----------|
| PKB | `Area/` | Human only | Read |
| Active work | `Project/` | Shared | Read, add notes |
| Raw refs | `Resource/` | Human only | Read |
| Archive | `Archive/` | Human only | Read |
| **Routing** | **`LIST.md`** | **Shared** | **Read, add items, suggest, flag stale** |
| Thinking | `Wiki/` | Agent | Full control |

---

## The Four Workflows

### 1. Source Consumption — "Discuss before recording"

User finds a source (URL, file, text). Before anything gets recorded, the user spends time with the agent discussing and consuming the information. This happens in Wiki.

```
User: "Here's an article about type systems"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Wiki/ (conversation + synthesis)                        │
│                                                          │
│  Agent captures source → inbox/ + summary page           │
│  Agent reads discussion route file → creates record      │
│  Agent and user discuss:                                 │
│    • What's important here?                              │
│    • How does this relate to what we already know?       │
│    • What should we keep?                                │
│  Summary page gets enriched with takeaways               │
│  Integration targets identified                          │
│  Topic pages updated with synthesis                      │
│  Discussion briefing file updated with results           │
│  Discussion state → finish                               │
└─────────────────────────────────────────────────────────┘
         │
         ▼  (reference, not flow)
┌─────────────────────────────────────────────────────────┐
│  PARA/ (referenced via Obsidian links)                   │
│                                                          │
│  Wiki topic pages link to Area/ PKB entries              │
│  Wiki treats Area/ as sources to reference               │
│  Nothing moves automatically from Wiki to PARA           │
│  They coexist as parallel layers                         │
└─────────────────────────────────────────────────────────┘
```

### 2. Project Planning — "Wiki first, PARA on demand"

When the user wants to plan a project, the agent reads Wiki first. Wiki already has past discussions, captured sources, topic synthesis, and previous plans. Only if Wiki doesn't have enough context does the agent reach into PARA.

```
User: "I want to plan a new project"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Wiki/ (read first)                                      │
│                                                          │
│  Agent reads Wiki context:                               │
│    • What topics relate to this project idea?            │
│    • What sources have we consumed on this topic?        │
│    • What past plans or discussions are relevant?        │
│    • What's in Wiki/drafts/ already?                     │
│  Wiki has enough → draft plan directly                   │
└─────────────────────────────────────────────────────────┘
         │
         ▼  (only if Wiki isn't enough)
┌─────────────────────────────────────────────────────────┐
│  PARA/ (on-demand deep dive)                             │
│                                                          │
│  Agent reaches into PARA:                                │
│    • Check Area/ for PKB entries on this topic           │
│    • Look at past Project/ frontmatter for patterns      │
│    • Scan Resource/ for related references               │
│  Agent refines Wiki context with PARA findings           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Wiki/ (drafting space)                                  │
│                                                          │
│  Agent + user interact:                                  │
│    • What's the goal?                                    │
│    • What are the steps?                                 │
│    • What's the timeline?                                │
│  Plan drafted in Wiki/pages/plans/ or Wiki/drafts/       │
│  Iterated until user is satisfied                        │
└─────────────────────────────────────────────────────────┘
         │
         ▼  (human decides, not automatic)
┌─────────────────────────────────────────────────────────┐
│  Project/ (active work)                                  │
│                                                          │
│  User creates the project folder in PARA                 │
│  Wiki plan page references the project via link          │
│  Agent tracks progress, suggests tasks in LIST.md        │
└─────────────────────────────────────────────────────────┘
```

**Important:** The agent does **not** create `Project/` folders. The user does. The Wiki plan was a thinking tool; the PARA project is a human curation decision. The Wiki plan page can reference the project and mirror its status, but it does not birth it.

### 3. Intelligence / Review — "Wiki first, PARA on demand"

The Wiki digest (`meta/wiki-digest.md`) is regenerated after every agent turn. It contains the current state: stats, active discussions, recent events, stale items. The agent reads the digest first. Only when it needs details or verification does it reach into PARA.

```
User: "What should I focus on this week?"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Wiki/ (agent reads first)                               │
│                                                          │
│  Read meta/wiki-digest.md                                │
│  Read meta/index.md for catalog                          │
│  Read discussions/route.md for continuity                │
│  Agent doesn't scan raw PARA every time                  │
│  Wiki contains enough context for most questions         │
│  "Here's what's been happening, here's what's stuck"     │
└─────────────────────────────────────────────────────────┘
         │
         ▼  (only when agent needs details)
┌─────────────────────────────────────────────────────────┐
│  PARA/ (on-demand deep dive)                             │
│                                                          │
│  Agent uses tools to:                                    │
│    • Verify something in Project/ frontmatter            │
│    • Check Area/ for a specific PKB entry                │
│    • Scan Resource/ for related references               │
│  Then refines Wiki with the findings                     │
└─────────────────────────────────────────────────────────┘
```

### 4. Real Wiki — "Wiki-style descriptions from PARA"

Wiki should build structured, readable pages based on PARA content. When the user asks "What is Project A?", the agent reads the Wiki topic page (which already has synthesis from past interactions) and gives a wiki-style description: when it started, what the purpose was, how it went, what the result was.

```
User: "What is Project A?"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Wiki/ (analysis + narrative)                            │
│                                                          │
│  Agent reads Wiki topic page for Project A               │
│  Wiki already has:                                       │
│    • Purpose (from planning discussions)                 │
│    • Timeline (from activity tracking)                   │
│    • Key decisions (from event log)                      │
│    • Current status (from sync)                          │
│  Agent synthesizes into wiki-style description:          │
│    "Project A started in March 2026 with the goal of..." │
│    "Key milestones: ..."                                 │
│    "Current status: active, blocked on API review"       │
└─────────────────────────────────────────────────────────┘
         │
         ▼  (only if agent needs to confirm details)
┌─────────────────────────────────────────────────────────┐
│  PARA/ (verification)                                    │
│                                                          │
│  Agent checks Project/A/index.md frontmatter             │
│  Agent reads notes.md for recent updates                 │
│  Agent refines Wiki description if needed                │
└─────────────────────────────────────────────────────────┘
```

---

## What Wiki/ Needs to Serve

| Function | What Wiki Contains | How It Helps |
|----------|-------------------|-------------|
| **Thinking space** | Captured sources, discussions, synthesis | User + agent work through knowledge together |
| **Drafting area** | Drafts, plan pages, project proposals | Ideas and plans iterate before becoming real |
| **Wiki digest** | Rolling `meta/wiki-digest.md` | Agent reads this first; regenerated after every turn |
| **Discussion history** | `discussions/route.md` + briefing files | Agent knows where it left off, what's ongoing |
| **Living index** | Topic pages that reference PARA via links | Wiki-style descriptions of PARA content |
| **PARA reference** | Obsidian links to Area/, Project/, Resource/ | Wiki treats PARA as sources to synthesize from |

---

## The Agent's Default Posture

> **The agent should almost never need to scan raw PARA.**

The Wiki should be rich enough that the agent can:
- Answer most questions from Wiki content
- Do most reviews from Wiki summaries
- Draft most plans from Wiki context
- Give wiki-style descriptions from Wiki synthesis
- Know where it left off from the discussion route file

The agent reaches into PARA only to:
- **Verify** something the Wiki says
- **Confirm** a detail that's missing from Wiki
- **Deep-dive** when the Wiki summary isn't enough
- **Reference** PARA content as sources for Wiki synthesis

Wiki and PARA are **parallel layers**, not sequential. Wiki references PARA via Obsidian links. Knowledge does not automatically flow from Wiki to PARA — but human curation decisions may create PARA content informed by Wiki synthesis.

---

---

## Key Design Decisions

### 1. Wiki digest — auto-generated

The extension auto-generates `meta/wiki-digest.md` after every agent turn. This is the agent's entry point — it contains stats, active discussions, recent events, stale items, and topics needing attention. The agent reads the digest first; no need to scan raw PARA every session.

If historical snapshots are needed, `meta/events.jsonl` already provides that. The digest is the current state; events.jsonl is the history.

**MVP content:**
```markdown
# Wiki Digest

## Stats
- Topics: 24 | Summaries: 18 | Plans: 3 | Reviews: 2
- Sources: 18 captured, 12 integrated, 4 consumed

## Active Discussions
(none until discussion system is built)

## Recent Events (last 7d)
- 2026-05-08 Captured SRC-2026-05-08-001

## Needs Attention
- lambda-calculus: 47 words (below minimum)
- functional-programming: no activity in 14d

## Stale
- old-source-1: integrated 21d, not consumed
```

**Implementation:** Build from existing components (`registry.json`, `events.jsonl`, `wiki_lint`, `wiki_scan_activity`). Trigger in the same pipeline as `rebuildAllGeneratedArtifacts()` — on-change only, via the existing `dirtyRoots` pattern. No new tools needed.

---

### 2. Discussion recording system

Wiki has a **route file** that tracks all discussions.

**MVP:** Files only. No new tools yet.

```
Wiki/discussions/
├── route.md              ← markdown with frontmatter
└── 2026-05-08-widget.md  ← briefing file
```

**route.md format (MVP):**
```markdown
---
type: discussion-route
updated: 2026-05-09
---

# Discussions

## Active
- [2026-05-08 Widget Launch](2026-05-08-widget.md) — planning

## Recent
- [2026-05-07 Type Systems](2026-05-07-type-systems.md) — source consumption ✓

## Archive
- [2026-05-01 FP Review](2026-05-01-fp-review.md) — internalized
```

**States:**
| State | Meaning |
|-------|---------|
| `ongoing` | Started, no result yet |
| `finish` | Got result, not internalized into PKB |
| `archive` | Internalized into PKB |
| `discord` | Started, then dropped |

**Agent behavior:**
1. At session start, read `route.md`
2. If continuing an active discussion, read the briefing file
3. After discussion, update briefing file with results
4. Update route.md status (via edit tool)

**Scalability note:** When discussions exceed ~100, `route.md` should show only active discussions. Completed/archived discussions move to `route-archive-YYYY-MM.md`. This is a Year 2 problem — don't solve it now.

---

### 3. Topic page lifecycle — consumable

Wiki topic pages follow the same lifecycle as summaries:

```
draft → integrated → consumed → archived → cleared
```

| State | Meaning | Included in search? |
|-------|---------|---------------------|
| `draft` | Created, not yet enriched | Yes |
| `integrated` | Has substantive synthesis | Yes |
| `consumed` | Knowledge internalized into PKB; page is reference | Yes (follows `pkb_refs`) |
| `archived` | Outdated, superseded | No (override with `includeArchived`) |
| `cleared` | Removed after grace period | No |

A topic page can be **consumed** (the knowledge is in PKB) but still **exist** as a reference. It doesn't get deleted; it stops being "active" — the agent doesn't need to maintain it anymore.

**Reactivation:** If a new source integrates into a consumed topic, the topic flips back to `integrated`. Consumed is a checkpoint, not a destination.

**Grace periods (lint suggestions, not auto-actions):**

| Transition | Trigger | Grace Period |
|------------|---------|-------------|
| `integrated` → suggest consumption | Age-based | 14 days since integration |
| `consumed` → suggest archival | Age-based | 30 days since consumed |
| `archived` → suggest clearing | Age-based | 60 days since archived |
| `draft` → flag stale | Activity-based | 30 days since last edit |

The agent **suggests**, never auto-transitions. Lint flags it. The agent presents it to the user. The user decides.

**Grace period constants (hardcoded for MVP):**
```typescript
// layer1/lifecycle.ts
export const GRACE_PERIODS = {
  integrated_to_consumed: 14,
  consumed_to_archived: 30,
  archived_to_cleared: 60,
  draft_stale: 30,
} as const;
```

---

### 4. Session start sequence

The agent reads three files in order at session start:

```
1. Wiki/discussions/route.md     → Where did I leave off?
2. Wiki/meta/wiki-digest.md      → What's the current state of Wiki?
3. LIST.md                       → What's pending from the human?
```

Then the agent is oriented. It knows what discussions are ongoing/finished, what Wiki contains, and what the human has queued up. Only after this does it respond to the user's question.

**Implementation:** Update `brain-wiki` SKILL.md startup checklist. No code change needed — it's a skill instruction, not a tool.

---

### 5. Wiki ↔ Area/ — reference, not mirror

Wiki topic pages refer to Area/ PKB entries via Obsidian links. Wiki treats Area/ entries as **sources** — a kind of knowledge to reference and synthesize from. Wiki is not a mirror of Area/. Wiki is an agent-oriented layer that **uses** PARA content.

---

### 6. Wiki ↔ PARA — parallel layers

Wiki and PARA are **not redundant**. They are parallel layers:
- **PARA** — human-curated, recorded truth
- **Wiki** — agent-oriented, thinking + synthesis layer

Wiki doesn't automatically feed into PARA. Wiki **references** PARA. The agent uses Wiki to think, discuss, and synthesize. The human uses PARA to curate and maintain permanent knowledge.

The one exception is `LIST.md`, which is genuinely shared — both human and agent read and write to it.

**Corollary:** The agent **never autonomously writes to PARA**. It proposes; the human decides. The agent executes only what the human authorizes.

---

### 7. `wiki_sync` — bootstrap, not continuous sync

`wiki_sync` is a **bootstrap tool** — run it once to seed Wiki topic pages from PARA folder structure. After that, the agent builds Wiki organically from discussions and sources.

| Tool | Old Role | New Role |
|------|----------|----------|
| `wiki_sync` | Continuous PARA→Wiki sync | **Bootstrap** — seed Wiki from PARA once |
| `wiki_triage` | LIST.md management | **Same** — LIST.md is still shared |
| `wiki_project_sync` | Scan Project/ for status | **On-demand verification** — check Project/ when Wiki doesn't have enough |

`wiki_sync` updates `last_synced` in topic frontmatter when it runs. `meta/sync-state.json` tracks the last full sync timestamp. Lint suggests re-running `wiki_sync` if PARA has new folders and `last_full_sync` is older than 30 days.

---

### 8. Briefing files

Individual discussion records are Markdown with frontmatter:

```markdown
---
date: 2026-05-08
topic: Widget Launch planning
state: ongoing
sources: []
related_topics: [topics/widget-launch]
---

# Widget Launch Planning

## Context
User wants to plan a new project for the widget launch.

## Discussion
- Reviewed existing resources in Resource/2 Business/
- Identified 3 key milestones
- Decided on May 15 deadline

## Outcomes
- Plan drafted in pages/plans/2026-05-08-plan.md
- Next steps: finalize API integration details

## Open Questions
- Who is the API contact?
- What's the fallback if deadline slips?
```

The agent writes this during/after the discussion. The route file points to it.

---

### 9. Drafts vs plans boundary

| Folder | Content | When |
|--------|---------|------|
| `Wiki/drafts/` | Ideas, WIP, half-formed thoughts | Any time, agent or user |
| `Wiki/pages/plans/` | Ready-to-execute plans | When user commits to action |

**Promotion path:**
```
Wiki/drafts/idea.md → agent + user iterate → user says "let's do this" → Wiki/pages/plans/YYYY-MM-DD-plan.md
```

The draft stays in `drafts/` as history. The plan is the committed version. No automatic promotion — user decides.

---

### 10. Staleness detection

**Topic frontmatter addition:**
```yaml
---
type: topic
title: Computer Science
status: integrated
last_synced: 2026-05-08
para_source: Resource/1 CS/
---
```

**Lint rule:** Compare `last_synced` on topic page to mtime of PARA folder. If PARA folder modified after `last_synced`, flag as stale:
> "topics/computer-science.md may be stale — Resource/1 CS/ modified 2026-05-09"

**Trigger:** Part of existing `wiki_lint` staleness mode. No new tool needed.

**Note:** mtime comparison is best-effort. Vault sync services (iCloud, Obsidian Sync, git) may alter mtimes without content changes. For v2, consider content hash instead.

---

### 11. Obsidian link resolution

Add a Layer 0 utility for resolving wikilinks to absolute paths:

```typescript
// src/paths.ts
export function resolveWikiLink(wikiRoot: string, link: string): string | null {
  // [[Area/1 CS/Type Theory]] → /path/to/vault/Area/1 CS/Type Theory.md
  // [[topics/functional-programming]] → /path/to/wiki/pages/topics/functional-programming.md
  // Returns null for unresolvable links
}
```

Layer 1 domain logic uses it. Layer 2 tools expose it if needed. Handles both PARA links (`Area/`, `Project/`, `Resource/`) and Wiki links (`topics/`, `summaries/`, `plans/`, `reviews/`).

---

### 12. Draft/ migration (phased deprecation)

**Phase 1 (now):** Create `Wiki/drafts/` in scaffold. Code uses `Wiki/drafts/`. Keep external `Draft/` in `allowExternal` with no warning.

**Phase 2 (next release):** Lint warning: "External `Draft/` detected. Consider moving to `Wiki/drafts/`."

**Phase 3 (release after that):** Remove external `Draft/` from `allowExternal`. Document migration.

**Obsidian links:** Existing `[[Draft/Foo]]` links won't break in Phase 1 or 2 — the file still exists. In Phase 3, the user has had time to move files and update links. Obsidian's rename/move handles link updates automatically.

---

### 13. "Below minimum" heuristic

**Single metric for MVP:** word count < 100.

```typescript
export function isBelowMinimum(page: RegistryEntry): boolean {
  return (page.wordCount ?? 0) < 100;
}
```

**Why single metric:** Easy to implement, understand, tune, and explain. "This topic has only 47 words. It needs more substance."

**Later (not MVP):** Add a second heuristic for orphaned topics (0 outbound links). But separate from "below minimum" — it's a different problem.

---

## Implementation Priority

| Priority | Issue | Why | Effort |
|----------|-------|-----|--------|
| **1** | Add `discussions/` + `drafts/` to bootstrap (#13) | Unblocks all other work | 5 min |
| **2** | Draft/ migration Phase 1 (#12) | Clean zone map | 30 min |
| **3** | Wiki digest (#2, #14) | Biggest lever. Unblocks "Wiki first" posture. | 2-3 hrs |
| **4** | Discussion system MVP (#3) | Files only, no new tools. Enables session continuity. | 1-2 hrs |
| **5** | Staleness detection (#5, #10) | Small change, big impact. Makes Wiki trustworthy. | 2-3 hrs |
| **6** | Link resolution (#8, #11) | Small utility. Enables agent to read PARA via Wiki links. | 1 hr |
| **7** | Lifecycle grace periods (#6, #15) | Formalize in existing lint. | 1-2 hrs |
| **8** | Session start update (#4, #9) | Update skills once digest + discussions exist. | 30 min |
| **9** | wiki_sync bootstrap semantics (#7, #11) | Change description, add `meta/sync-state.json`. | 1 hr |
| **10** | Route scalability (#4) | Year 2 problem. Don't solve now. | — |

---

## Changelog from v2

| # | Change | Source |
|---|--------|--------|
| 1 | Added Draft/ phased deprecation plan | `issue-v3.md` #12, `addition-items-v3.md` #12 |
| 2 | Added bootstrap folder fix | `issue-v3.md` #13, `addition-items-v3.md` #13 |
| 3 | Specified digest on-change rebuild via `dirtyRoots` | `issue-v3.md` #14, `addition-items-v3.md` #14 |
| 4 | Specified hardcoded grace period constants | `issue-v3.md` #15, `addition-items-v3.md` #15 |
| 5 | Defined "below minimum" as word count < 100 | `issue-v3.md` #16, `addition-items-v3.md` #16 |
| 6 | Confirmed frontmatter + markdown for route.md | `issue-v3.md` #17, `addition-items-v3.md` #17 |
| 7 | Updated implementation priority with effort estimates | `addition-items-v3.md` summary |
