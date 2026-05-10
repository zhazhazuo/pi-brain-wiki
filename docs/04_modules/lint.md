# Module: lint

## Responsibility

Runs structural health checks on the wiki: validates links (no broken wikilinks), detects orphan pages (no incoming links), validates frontmatter (required fields present), detects duplicate titles/aliases, checks coverage (topic completeness), flags stale pages, and detects stale sync (PARA folder newer than last_synced).

## Entry Points

- extensions/brain-wiki/src/lint.ts → runLint()

## Key Files

- extensions/brain-wiki/src/lint.ts → all lint check logic

## Constraints

- Six lint modes: links, orphans, frontmatter, duplicates, coverage, staleness
- Results are written to meta/lint-report.md
- PARA links are not flagged as broken — they point outside the wiki
- Operates on the generated registry and backlinks data

## Lifecycle-Aware Checks

- `archived` and `cleared` pages are skipped by all lint checks
- `consumed` pages are validated for required `consumed_at` and `pkb_refs` fields
- Staleness check detects `consumed` topics with newly integrated inbound sources (reactivation candidates)
- Stale sync check compares `last_synced` frontmatter to PARA folder mtime

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/lint.ts | runLint(): dispatches to mode-specific checkers; lintStaleSync() flags topics where PARA mtime > last_synced; results written to meta/lint-report.md |
| Consumer | extensions/brain-wiki/index.ts | wiki_lint tool handler calls runLint() |
| Consumer | extensions/brain-wiki/src/digest.ts | digest reads lint output to populate "Stale" section |
