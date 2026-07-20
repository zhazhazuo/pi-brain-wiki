---
name: brain-wiki
description: Use when operating on the Brain Wiki vault — capturing sources, querying knowledge, integrating content, or analyzing activity. Shared rules for all wiki agents.
---

# Brain Wiki — Shared Rules

All wiki agents (Map, Workshop, Intelligence) load this skill. It defines the shared editorial discipline, boundary rules, and conventions every agent must follow.

## Sub-files

Load these on demand — don't read them all upfront. The skill tells you which one you need.

| File | When to load |
|------|-------------|
| `instructions/startup.md` | **Always first.** Session start: LIST.md protocol, discussion system |
| `instructions/rules.md` | Before any wiki write. Non-negotiable rules, guardrails, PARA integration, absorption loop |
| `instructions/writing-standards.md` | Before writing any wiki page. Tone, quotes, length targets, anti-cramming, anti-thinning, concrete noun test |
| `instructions/frontmatter.md` | When creating or editing page frontmatter. Conventions for each page type |
| `instructions/page-lifecycle.md` | When changing page status. Lifecycle states, transitions, reactivation |
| `instructions/mini-search.md` | **On demand** when the session reasons about PKB content. Full-text search over `Area/`/`Resource/`/`Draft/`/`Project/` via `context-mode`. Mandatory for `wiki-workshop` Phase 3 |

## Startup (Mandatory)

Every session: load `instructions/startup.md`, follow the startup checklist, read LIST.md, surface unprocessed items to Walker before doing anything else.
If the session will reason about PKB content (what the user already knows), also load `instructions/mini-search.md` — it defines the `context-mode`-based PKB full-text search convention. This is mandatory for `wiki-workshop` Phase 3 and recommended for `wiki-map` deep dives and `wiki-intel` coverage-gap analysis. Skip it for wiki-only queries.
If a downstream skill cannot resolve `brain-wiki` as a separate activation, it must continue with the copied startup/rules files in that skill instead of blocking the session.

## Core Rules (Always Active)

1. Never directly edit `inbox/**` or `meta/**` — code-guarded
2. Every source → summary page first, before influencing topics
3. Discovery is graph-first — search the full vault, then use graph tools before editing
   and do not use shell spelunking when a native tool can answer the question
4. Prefer updating existing pages over creating new ones — resolve existing pages before creating new ones
5. Use folder-qualified wikilinks: `[[topics/foo]]` not `[[Foo]]`
6. Cite claims with stable source IDs near the fact
7. Keep uncertainty visible — `Tensions / caveats`, `Open questions`
8. Query mode is read-only by default
9. Use Obsidian CLI for supported vault-visible reads and writes
10. Never write outside `Wiki/` without explicit permission

**Exception:** `LIST.md` — agents may write sub-level lines and toggle checkboxes per the startup protocol.

## Writing Quick Reference

Full rules in `instructions/writing-standards.md`. Key points:

- **Tone:** Encyclopedic. No em dashes, no peacock words, no editorial voice.
- **Quotes:** Max 2 per page.
- **Length:** Summaries 20-40 lines, topics 5-20 lines. Split if exceeding threshold.
- **Anti-cramming:** Third paragraph about a sub-topic → create its own page.
- **Anti-thinning:** Every edit must add real substance.
- **Concrete noun test:** "X is a ___" — if you can't fill the blank with something specific, don't create the page.

## Tools

| Tool | Purpose |
|------|---------|
| `wiki_capture_source` | Capture URL/file/text into inbox + summary stub |
| `wiki_search` | Search the vault first, or the wiki registry for exact wiki lookup |
| `wiki_graph_find` | Find related wiki and PKB nodes across the vault |
| `wiki_graph_traverse` | Inspect backlinks, links, and second-hop neighbors |
| `wiki_graph_bridge` | Find missing PKB or wiki connections for an existing page |
| `wiki_context_list` | List configured external repo contexts and access steps |
| `wiki_context_resolve` | Resolve external context from context id or PKB note (no repo reads) |
| `wiki_context_gather` | Bounded read-only gather from a linked local repository by intent |
| `wiki_ensure_page` | Resolve or create canonical topic page safely |
| `wiki_log_event` | Record structured events (capture, integrate, query, etc.) |
| `wiki_sync` | Seed topics from PARA vault structure |
| `wiki_triage` | Read/add/suggest/flag_stale in LIST.md |
| `wiki_project_sync` | Scan/add_note/suggest_task in Project/ |
| `wiki_generate_workflow` | Create standardized workflow pages |
| `wiki_lint` | Run deterministic health checks, including page-type conformance rules |
| `wiki_scan_activity` | Scan vault and wiki activity |
| `wiki_rebuild_meta` | Force rescan and rebuild metadata |
| `wiki_task` | Taskwarrior: promote/annotate/done (load `taskwarrior` skill) |
| `wiki_task_scan` | Taskwarrior: scan vault for task proposals |
| `wiki_week` | Taskwarrior: refresh WEEK.md dashboard |

## Taskwarrior

Load the `taskwarrior` skill for all task operations. The protocol is defined there, not here.

## External Context

Load the `map-external-context` skill when Walker wants repo-backed context for a PKB note or linked codebase. Route through `wiki_context_resolve` → `wiki_context_gather`; do not browse external repos directly.
