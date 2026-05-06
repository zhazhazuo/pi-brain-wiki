# Wiki Lifecycle System

> Added: 2026-05-06

## What it does

Gives wiki knowledge a clean lifecycle from first capture to PKB residency. Pages move through statuses: captured → integrated → consumed → archived → cleared, with reactivation support for consumed topics that receive new sources.

## Key changes

- **New statuses:** `consumed` and `cleared` added to the page lifecycle
- **Search filtering:** `wiki_search` excludes archived/cleared by default; `includeArchived` override
- **Lint awareness:** Archived/cleared pages skipped; consumed pages validated for `consumed_at` and `pkb_refs`; stale consumed detected
- **Lifecycle backlog:** `wiki_scan_activity` returns backlog data (awaiting recall, reactivations, clearable)
- **Recall skill:** Comparison workflow for wiki source vs PKB entry
- **`/wiki-consumed` command:** Fast path for marking pages consumed without a full Recall session
- **Reactivation:** Consumed topics flip back to `integrated` when new sources arrive

## Frontmatter fields

New fields for `consumed` status pages:
- `consumed_at`: ISO timestamp
- `pkb_refs`: Array of vault-relative paths to PKB entries

## Event kinds

New `wiki_log_event` kinds: `consumed`, `archived`, `cleared`
