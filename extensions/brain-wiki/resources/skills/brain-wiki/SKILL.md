---
name: brain-wiki
description: Use when operating on the Brain Wiki vault — capturing sources, querying knowledge, integrating content, or analyzing activity. Shared rules for all wiki agents.
---

# Brain Wiki — Shared Rules

All wiki agents (Map, Workshop, Intelligence) load this skill. It defines the shared editorial discipline, boundary rules, and conventions that every agent must follow.

## Startup

Every wiki session starts by reading these files in order:

1. **`Wiki/discussions/route.md`** — active discussions, where we left off
2. **`Wiki/meta/wiki-digest.md`** — current wiki state: stats, events, stale items
3. **`Wiki/WIKI_SCHEMA.md`** — vault conventions, page types, naming rules
4. **`Wiki/.wiki/config.json`** — directory paths, page types, protected paths
5. **`Wiki/meta/index.md`** — current page catalog (or use `wiki_search` if index is large)
6. **`LIST.md`** — the inbound command center: pending items, sources to capture, tasks, ideas

Never skip this. Never edit without re-orienting to current wiki state.

### LIST.md Protocol (all agents)

LIST.md is the single front door for everything Walker receives. It lives at vault root (outside `Wiki/`) and uses this format:

```markdown
**2026-05-07**
- [ ] https://example.com/blog-post about type systems
- [ ] Design review feedback from Sarah
- [ ] Idea: automate wiki linting on git hook
```

**At every session start, all agents must:**

1. Read `LIST.md` in full
2. Identify **unprocessed** items (`[ ]` and `[>]`) — these are backlog
3. Categorize each by content: source URLs, tasks, ideas, meeting notes, plans
4. Surface findings to Walker before doing anything else:
   - "3 unprocessed items. One is a blog link — want me to capture it?"
   - "One task from May 3 is still open."
   - "2 ideas in LIST.md I haven't seen before."
5. If the session is a workshop, ask: "There's a URL in LIST.md that hasn't been captured. Process it first?"
6. If the session is a query, check: "There's an idea in LIST.md related to your question — want me to incorporate it?"
7. If the session is intelligence, include LIST.md health in the analysis (see Intel skill)

**Agent mark format — every agent-written line uses exactly this format:**

```markdown
  A 2026-05-07T14:30 → Captured as SRC-2026-05-07-001
  A 2026-05-07T14:35 → Integrated into [[topics/wireframe-design]]
```

- Always indented with 2 spaces under the user's item
- Always starts with `A YYYY-MM-DDTHH:MM →`
- Never adds new top-level `- [ ]` items
- Never reorders or edits existing entries
- Only toggles `[ ]` → `[>]` (in-progress) and `[ ]` → `[x]` (done/processed)
- Every toggle appends an agent line with timestamp

**Agent writing rules:**
- Agent may write sub-level lines under any existing item
- Agent may toggle checkboxes: `[ ]` → `[>]` or `[ ]` → `[x]`
- Agent may NOT create new `- [ ]` top-level items
- Agent may NOT edit or reorder existing user items
- Agent may NOT toggle `[>]` or `[x]` backwards

## Discussion System

The wiki maintains a discussion record in `Wiki/discussions/` for session continuity.

**At session start:**
1. Read `Wiki/discussions/route.md`
2. Check if there are active discussions (state: `ongoing`)
3. If continuing an active discussion, read the briefing file

**During a discussion:**
1. Create or update the briefing file (`Wiki/discussions/YYYY-MM-DD-topic.md`)
2. Record: context, key points, outcomes, open questions
3. Update `route.md` to reflect the discussion state

**Discussion states:**
| State | Meaning |
|-------|---------|
| `ongoing` | Started, no result yet |
| `finish` | Got result, not internalized into PKB |
| `archive` | Internalized into PKB |
| `discord` | Started, then dropped |

**No new tools for MVP.** The agent uses existing `read`/`write`/`edit` on markdown files.

## Non-Negotiable Rules

1. **Never directly edit `inbox/**` or `meta/**`.** These are code-guarded. Use `wiki_capture_source` for inbox and let the extension handle meta.
2. **Every source → summary page first.** No source influences canonical topics before it has a summary page with Integration Targets.
3. **Prefer updating existing pages over creating new ones.** Search first with `wiki_search`. Resolve or create safely with `wiki_ensure_page`.
4. **Use folder-qualified wikilinks** for all wiki-internal references:
   - `[[topics/functional-programming]]` not `[[Functional Programming]]`
   - `[[summaries/2026-05-05-Backus-Turing-Award]]` not `[[Backus Turing Award]]`
5. **Cite claims with stable source IDs.** `[[summaries/2026-05-05-Source|2026-05-05-Source]]` near the factual claim, not just once at the bottom.
6. **Keep uncertainty visible.** Use `Tensions / caveats` and `Open questions` sections. Never collapse ambiguity into false certainty.
7. **Query mode is read-only by default.** Only write to the wiki when explicitly asked or when performing an ingest/integrate workflow.
8. **Never write outside `Wiki/` without explicit permission.** The wiki domain is `Wiki/`. PARA folders (Resource/, Project/, Area/, Draft/) are read-only for agents.

**Exception: `LIST.md`** — agents may write sub-level agent lines and toggle checkboxes in LIST.md, following the LIST.md Protocol rules above. This is the only PARA file agents may modify.

## Writing Standards

### Tone: Encyclopedic, Not AI

Write flat, factual, like a good Wikipedia article. The page stays neutral. Direct quotes from sources carry the voice.

**Never use:**
- Em dashes
- Peacock words: "legendary," "visionary," "groundbreaking," "deeply," "truly"
- Editorial voice: "interestingly," "importantly," "it should be noted"
- Rhetorical questions
- Progressive narrative: "would go on to," "embarked on," "this journey"
- Qualifiers: "genuine," "raw," "powerful," "profound"

**Do:**
- Lead with the subject, state facts plainly
- One claim per sentence. Short sentences.
- Simple past or present tense
- Attribution over assertion: "The source describes it as energizing" not "It was energizing"
- Let facts imply significance
- Dates and specifics replace adjectives

### Quote Discipline

Maximum **2 direct quotes** per page. Pick the lines that hit hardest. Quotes carry the voice; the article stays neutral.

### Length Targets

| Type | Target Lines | Split Signal |
|------|-------------|-------------|
| Summary | 20-40 lines | >60 |
| Topic | 5-20 lines | >30 |
| Plan | 20-40 lines | >60 |
| Review | 20-40 lines | >60 |
| Minimum (any page) | 5 lines | — |

Split signal: any page exceeding its threshold should be split into focused sub-pages.

### Anti-Cramming

The gravitational pull of existing pages is the enemy. If you're adding a third paragraph about a sub-topic to an existing page, that sub-topic probably deserves its own page. **Create focused pages aggressively.**

### Anti-Thinning

Creating a page is not the win. Enriching it is. **Every time you touch a page, it must get meaningfully richer.** A stub with 3 vague sentences when other sources also mention that topic is a failure.

### Concrete Noun Test

Before creating a new topic page, ask: **"X is a ___"**

**Creates a page** if:
- Named people, places, companies, organizations, institutions
- Named events or turning points with dates
- Books, films, papers, products referenced substantively
- Projects with names and commitments
- Concepts with a clear definition and multiple sources

**Does NOT create a page** if:
- Generic technologies (React, Python, Docker) — unless there's a documented learning arc
- Passing mentions
- Things you can't write 3+ meaningful sentences about
- Single-source trivia

## Absorption Loop

Before touching any page, you MUST:

1. Re-read `meta/index.md` (or use `wiki_search`) — orient to current wiki state
2. Re-read every page you're about to edit — understand what's already there
3. Never edit blind — understand current state first

This applies to every session, every ingest, every edit. No exceptions.

## Page Lifecycle

```
captured → integrated → consumed → archived → cleared
               ↑            │
               └────────────┘  (reactivation on new source)
```

| Status | Meaning | When Applied |
|--------|---------|-------------|
| `captured` | Source ingested but not integrated into topics | Auto-set on capture |
| `integrated` | Content woven into wiki; page is authoritative | Set after integration complete |
| `consumed` | Walker has internalized this; PKB is the source of truth | Set via Recall skill or `/wiki-consumed` command |
| `draft` | Topic page exists but not yet authoritative | Set on topic creation |
| `contested` | Two sources openly disagree; resolution pending | Set when contradiction flagged |
| `superseded` | Newer source has replaced this page's claims | Old page kept for provenance |
| `archived` | Retired; excluded from search and lint by default | Set when knowledge is fully in PKB and no longer needed in wiki |
| `cleared` | Removed from wiki; preserved during grace period | Set by Recall/Intelligence when archiving clears old entries |

**Reactivation:** When a new source is integrated into a `consumed` topic, flip the topic back to `integrated`. Consumed is a checkpoint, not a destination.

**Superseded sources are never deleted.** They preserve the evolution of understanding. The newer page links back: "Supersedes `[[summaries/old-summary]]`."

## PARA Integration Rules

### Zone Map

| Zone | Path | Agent | Human |
|------|------|-------|-------|
| **Human-only** | `Area/` | Read only | Full control |
| **Agent-writable** | `Resource/` | Can create/edit | Full control |
| **Shared** | `LIST.md`, `Project/` | Can read/write | Full control |
| **Wiki (agent-owned)** | `Wiki/` | Full control | Read/browse |

**Note:** `Draft/` has moved into `Wiki/drafts/` as of v3. The agent uses `Wiki/drafts/` for work-in-progress. External `Draft/` at vault root is deprecated.

### New Tools

- `wiki_sync` — scan PARA vault structure, create/update wiki topic pages
- `wiki_triage` — read/add/suggest/flag_stale in LIST.md
- `wiki_project_sync` — scan/add_note/suggest_task in Project/

### LIST.md AI Content Rule

All agent content in LIST.md must use:
```markdown
> 🤖 [AI] Agent note: ...
```

### Obsidian CLI First

Use Obsidian CLI for all supported operations (move, rename, create, read). Direct filesystem only for unsupported operations.

### Legacy Rules

- **Read freely:** Project/, Area/, Resource/, Draft/, LIST.md are all readable
- **One-way links:** Wiki → PARA only. Never the reverse.
- **Annotate external links with context:**
  ```markdown
  See [[Project/Widget Launch]] (status: active, deadline May 15).
  [[Area/1 CS/17 AI/LLM Memory]] — PKB entry covering the technical background.
  [[Resource/type-theory-paper.pdf]] — external reference on dependent types.
  ```
- **Never modify Area/ files.** Agent may write to Resource/ and Draft/.

**Semantic note:** `Area/` is the PKB (long-term knowledge, consumed wiki content). `Resource/` is external reference material (inputs from outside, raw notes). Follow wikilinks into `Area/` when you need depth on a consumed topic.

## Frontmatter Conventions

### Summary pages
```yaml
id: SRC-2026-05-05-001
type: summary
title: "Source Title"
status: captured
captured_at: 2026-05-05
integrated_at:
consumed_at:    # ISO date when Walker confirmed internalization (only for consumed status)
pkb_refs:       # Array of vault-relative paths to PKB entries (only for consumed status)
origin_type: url
origin_value: https://...
manifest_path: inbox/SRC-2026-05-05-001/manifest.json
raw_path: inbox/SRC-2026-05-05-001/extracted.md
aliases: []
tags: []
source_ids: [SRC-2026-05-05-001]
```

### Topic pages
```yaml
id: topic-functional-programming
type: topic
title: "Functional Programming"
aliases: [FP]
tags: [programming-paradigm]
status: integrated
updated: 2026-05-05
source_ids: []
consumed_at:    # ISO date when Walker confirmed internalization (only for consumed status)
pkb_refs:       # Array of vault-relative paths to PKB entries (only for consumed status)
links:
  - "[[topics/Lambda-Calculus]]"
  - "[[Area/1 CS/11 Programming Language/FP.md]]"
```

### Plan pages
```yaml
id: plan-2026-05-05
type: plan
title: "2026-05-05 Plan"
status: active
date: 2026-05-05
updated: 2026-05-05
```

### Review pages
```yaml
id: review-2026-W19
type: review
title: "2026 W19 Review"
status: active
period: 2026-W19
updated: 2026-05-05
```

## Guardrails

- Never delete or modify files outside `Wiki/` without explicit permission
- Flag contradictions during ingest; surface to user, don't silently reconcile
- When uncertain about JD placement, propose with reasoning — don't assume
- After any wiki mutation, the extension auto-rebuilds `meta/` — trust this, don't manual-edit those files
