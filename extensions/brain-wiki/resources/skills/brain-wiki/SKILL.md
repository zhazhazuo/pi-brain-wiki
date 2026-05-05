---
name: brain-wiki
description: Use when operating on the Brain Wiki vault — capturing sources, querying knowledge, integrating content, or analyzing activity. Shared rules for all wiki agents.
---

# Brain Wiki — Shared Rules

All wiki agents (Map, Workshop, Intelligence) load this skill. It defines the shared editorial discipline, boundary rules, and conventions that every agent must follow.

## Startup

Every wiki session starts by reading these files in order:

1. **`Wiki/WIKI_SCHEMA.md`** — vault conventions, page types, naming rules
2. **`Wiki/.wiki/config.json`** — directory paths, page types, protected paths
3. **`Wiki/meta/index.md`** — current page catalog (or use `wiki_search` if index is large)

Never skip this. Never edit without re-orienting to current wiki state.

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
captured → integrated → contested | superseded | archived
```

| Status | Meaning | When Applied |
|--------|---------|-------------|
| `captured` | Source ingested but not integrated into topics | Auto-set on capture |
| `integrated` | Content woven into wiki; page is authoritative | Set after integration complete |
| `draft` | Topic page exists but not yet authoritative | Set on topic creation |
| `contested` | Two sources openly disagree; resolution pending | Set when contradiction flagged |
| `superseded` | Newer source has replaced this page's claims | Old page kept for provenance |
| `archived` | Retired to Wiki/archive/ | Set on commit-to-KB or when no longer needed |

**Superseded sources are never deleted.** They preserve the evolution of understanding. The newer page links back: "Supersedes `[[summaries/old-summary]]`."

## PARA Integration Rules

- **Read freely:** Project/, Area/, Resource/, Draft/, LIST.md are all readable
- **One-way links:** Wiki → PARA only. Never the reverse.
- **Annotate external links with context:**
  ```markdown
  See [[Project/Widget Launch]] (status: active, deadline May 15).
  [[Resource/1 CS/17 AI/LLM Memory]] covers the technical background.
  ```
- **Never modify PARA files.** Propose placement; Walker decides.

## Frontmatter Conventions

### Summary pages
```yaml
id: SRC-2026-05-05-001
type: summary
title: "Source Title"
status: captured
captured_at: 2026-05-05
integrated_at:
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
links:
  - "[[topics/Lambda-Calculus]]"
  - "[[Resource/1 CS/11 Programming Language/FP.md]]"
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
