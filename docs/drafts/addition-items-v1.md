# Wiki Position — Addition Items v1

> **Companion to:** `2026-05-08-wiki-position-and-role.md`
> **Date:** 2026-05-08
> **Status:** Draft — answers to underspecified topics

---

## 1. Vault Structure — discussions/ folder

The `discussions/` folder is missing from the vault structure diagram. Updated:

```
Wiki/
├── .wiki/config.json
├── inbox/            ← captured sources (immutable)
├── drafts/           ← ideas, WIP (mutable)
├── discussions/      ← discussion records
│   ├── route.md      ← index of all discussions
│   └── YYYY-MM-DD-topic.md  ← individual briefings
├── pages/
│   ├── topics/
│   ├── summaries/
│   ├── plans/
│   └── reviews/
└── meta/             ← auto-generated
```

---

## 2. Wiki Digest

**Decision:** One rolling file in `meta/`, auto-regenerated after every agent turn (same trigger as registry.json rebuild).

```
meta/
├── registry.json       ← all pages indexed
├── backlinks.json      ← link graph
├── wiki-digest.md      ← agent's entry point
├── events.jsonl        ← event log
├── log.md              ← human-readable log
└── index.md            ← page catalog
```

**Format:**

```markdown
# Wiki Digest
<!-- auto-generated, do not edit -->

## Stats
- Topics: 24 | Summaries: 18 | Plans: 3 | Reviews: 2
- Sources captured: 18 | Integrated: 12 | Consumed: 4

## Active Discussions
- [finish] 2026-05-07 Type systems article
- [ongoing] 2026-05-08 Widget Launch planning

## Recent Events (last 7 days)
- 2026-05-08 Captured SRC-2026-05-08-001: "Type Systems Survey"
- 2026-05-07 Integrated into topics/type-theory

## Topics Needing Attention
- lambda-calculus — 2 sentences, below minimum
- functional-programming — no activity in 14 days

## Stale Items
- [summaries/old-source-1] integrated 21 days, not consumed
```

This replaces the need to scan all topic pages. Agent reads this, knows the state of Wiki.

---

## 3. Daily Digest vs Wiki Digest

**Decision:** These are the same thing. The Wiki digest IS the daily digest. It's regenerated after every agent turn, so it's always current. No need for a separate "daily" concept.

If historical snapshots are needed, `meta/events.jsonl` already provides that. The digest is the current state; events.jsonl is the history.

---

## 4. Briefing Files

**Decision:** Markdown with frontmatter. Keep it simple.

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

## 5. Wiki ↔ PARA Sync

**Decision:** `wiki_sync` still makes sense, but its role changes. It's not "PARA feeds Wiki." It's "Wiki seeds its structure from PARA, then the agent enriches it."

**Before (old model):**
```
PARA folders → wiki_sync → topic pages (skeleton) → agent enriches → flows back to PARA
```

**After (new model):**
```
PARA folders → wiki_sync → topic pages (skeleton with Vault Map)
                                  ↓
                          agent enriches via discussions, sources, synthesis
                                  ↓
                          topic pages become rich Wiki content
                                  ↓
                          Wiki references PARA via Obsidian links
                          (nothing flows back)
```

`wiki_sync` becomes a **bootstrap tool** — run it once to seed Wiki from PARA structure. After that, the agent builds Wiki organically from discussions and sources. The Vault Map section in topic pages links to PARA, but Wiki doesn't mirror PARA — it synthesizes from it.

**Tool role changes:**

| Tool | Old Role | New Role |
|------|----------|----------|
| `wiki_sync` | Continuous PARA→Wiki sync | **Bootstrap** — seed Wiki from PARA once, then agent builds organically |
| `wiki_triage` | LIST.md management | **Same** — LIST.md is still shared |
| `wiki_project_sync` | Scan Project/ for status | **On-demand verification** — agent checks Project/ when Wiki doesn't have enough |

---

## 6. Topic Page States

**Decision:** Same lifecycle as summaries.

```
draft → integrated → consumed → archived → cleared
```

| State | Meaning for Topics |
|-------|-------------------|
| `draft` | Created by wiki_sync or agent, not yet enriched |
| `integrated` | Has substantive synthesis from discussions/sources |
| `consumed` | Knowledge internalized, page is now a reference |
| `archived` | Outdated, superseded by newer topic |
| `cleared` | Removed after grace period |

A topic page can be **consumed** (the knowledge is in PKB) but still **exist** as a reference. It doesn't get deleted. It just stops being "active" — the agent doesn't need to maintain it anymore.

---

## 7. LIST.md Position

**Decision:** LIST.md is the **exception** to the "PARA = human-curated" rule. It's genuinely shared.

| Zone | Owner | Agent Can |
|------|-------|-----------|
| Area/ | Human only | Read |
| Project/ | Shared | Read, add notes |
| Resource/ | Human only | Read |
| Archive/ | Human only | Read |
| **LIST.md** | **Shared** | **Read, add items, suggest, flag stale** |
| Wiki/ | Agent only | Full control |

Update the main draft: "PARA is human-curated **except LIST.md**, which is shared."

---

## 8. Session Start Sequence

**Decision:** Three reads, in this order:

```
1. Wiki/discussions/route.md    → Where did I leave off?
2. Wiki/meta/wiki-digest.md     → What's the current state of Wiki?
3. LIST.md                      → What's pending from the human?
```

Then the agent is oriented. It knows:
- What discussions are ongoing/finished
- What Wiki contains (topics, sources, plans)
- What the human has queued up

Only after this does the agent respond to the user's question.

---

## 9. Old Model → New Model Migration

**Decision:** The tools change roles:

| Tool | Old Role | New Role |
|------|----------|----------|
| `wiki_sync` | Continuous PARA→Wiki sync | **Bootstrap** — seed Wiki from PARA once, then agent builds organically |
| `wiki_triage` | LIST.md management | **Same** — LIST.md is still shared |
| `wiki_project_sync` | Scan Project/ for status | **On-demand verification** — agent checks Project/ when Wiki doesn't have enough |
| `wiki_capture_source` | Capture sources | **Same** — but now also creates discussion record |
| `wiki_search` | Search registry | **Same** — agent searches Wiki first |
| `wiki_lint` | Structural checks | **Same** — but checks Wiki integrity, not PARA sync |
| `wiki_log_event` | Record events | **Same** — events feed the digest |

**New tools needed:**

| New Tool | Purpose |
|----------|---------|
| `wiki_discussion_start` | Create discussion record in route file |
| `wiki_discussion_update` | Update briefing file with results |
| `wiki_discussion_finish` | Mark discussion as finish/archive/discord |

---

## 10. Relationship to Layer Architecture

**Decision:** The layers map cleanly:

```
Layer 3 (Agent)    → Skills decide WHEN to use Wiki vs PARA
                     wiki-map: "Search Wiki first, PARA on demand"
                     wiki-workshop: "Discuss in Wiki, capture sources"
                     wiki-intel: "Read Wiki digest, synthesize"

Layer 2 (Pi Harness) → Tools expose Wiki operations to Pi
                       wiki_search, wiki_capture_source, wiki_discussion_*

Layer 1 (Domain)   → Wiki business logic
                     parseRouteFile(), buildDigest(), parseBriefing()

Layer 0 (Commands) → Read/write Wiki files + Obsidian CLI
                     fs.ts, obsidian.ts, vault.ts
```

The Wiki positioning is a **Layer 1 concern** — the domain logic decides what Wiki contains and how it relates to PARA. The skills (Layer 3) enforce the "Wiki first, PARA on demand" posture. The tools (Layer 2) make it possible.

---

## Summary of All Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | discussions/ folder | Add to vault structure under Wiki/ |
| 2 | Wiki digest | One rolling file in meta/, auto-regenerated after each agent turn |
| 3 | Daily digest | Same as Wiki digest — no separate concept |
| 4 | Briefing files | Markdown with frontmatter, one file per discussion |
| 5 | Wiki ↔ PARA sync | wiki_sync becomes bootstrap tool, not continuous sync |
| 6 | Topic page states | Same as summaries: draft → integrated → consumed → archived → cleared |
| 7 | LIST.md position | Exception to "PARA = human-curated" — it's shared |
| 8 | Session start | route.md → wiki-digest.md → LIST.md |
| 9 | Tool migration | Existing tools change roles, 3 new discussion tools needed |
| 10 | Layer architecture | Wiki positioning is Layer 1 concern, skills enforce posture |
