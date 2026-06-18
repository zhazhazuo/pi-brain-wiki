# 04 Modules

## Core pipeline

- [capture](capture.md) — Source capture and summary scaffolding: immutable inbox packet + pages/summaries/ stub
- [config](config.md) — Wiki configuration loading, creation, and defaults for .wiki/config.json
- [paths](paths.md) — Root discovery, vault path resolution, wikilink-to-filesystem mapping
- [scaffold](scaffold.md) — Vault bootstrap: directory structure, templates, schema, and canonical page creation
- [frontmatter](frontmatter.md) — YAML frontmatter parsing, template rendering, page serialization, and property writes
- [indexer](indexer.md) — Registry, backlinks, and index generation from all wiki pages
- [search](search.md) — Registry search with keyword matching, scoring, and ranking

## Health and guardrails

- [lint](lint.md) — Structural health checks: links, orphans, frontmatter conformance, duplicates, coverage, staleness, stale sync
- [guards](guards.md) — Protected path enforcement: blocks writes to inbox/ and meta/, triggers auto-rebuild
- [lifecycle](lifecycle.md) — Hardcoded grace period constants for page lifecycle transitions

## Auxiliary

- [types](types.md) — Shared TypeScript interfaces, types, and enums
- [slug](slug.md) — Slug and ID generation: title slugification, source/page IDs, deduplication
- [digest](digest.md) — meta/wiki-digest.md builder: agent entry point with stats, events, stale items
- [log](log.md) — Structured event logging: events.jsonl append and log.md regeneration
- [activity](activity.md) — Vault and wiki activity scanning: LIST.md parsing, typed item detection

## PARA integration

- [sync](sync.md) — PARA vault folder sync to wiki topics: Area/, Resource/, Project/
- [triage](triage.md) — LIST.md routing center: read, add, suggest, flag stale
- [project-sync](project-sync.md) — Project/ folder sync: weekly notes, future-mode metadata, task suggestions
- [task-sync](task-sync.md) — Bidirectional LIST.md ↔ Taskwarrior sync

## Obsidian integration

- [obsidian-cli](obsidian-cli.md) — Obsidian CLI integration notes and context
- [obsidian-io](obsidian-io.md) — Obsidian CLI-backed markdown/property IO boundary
