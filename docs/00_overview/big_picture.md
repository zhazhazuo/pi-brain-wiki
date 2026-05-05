# Big Picture

## What the system does

A pi-coding-agent extension that turns a directory of markdown files into a structured, LLM-maintainable wiki with immutable source capture, generated metadata, linting, and wiki-maintenance skills.

## Core flow

pi agent session → wiki tools (capture/search/lint/ensure) → .wiki/config.json + inbox/ + pages/ + meta/

- `wiki_capture_source` — preserves a URL/file/text as an immutable packet in inbox/, creates a summary page in pages/summaries/
- `wiki_search` — queries a compiled registry of all wiki pages
- `wiki_lint` — runs structural health checks (links, orphans, frontmatter, duplicates, coverage, staleness)
- `wiki_ensure_page` — creates canonical topic pages with deduplication
- `wiki_bootstrap` — initializes the vault directory structure, config, and templates
- Guard hooks — block `write`/`edit` on protected paths (inbox/, meta/), trigger auto-rebuild of generated metadata on agent end

## Constraints

- Never edit inbox/** or meta/** directly — those are generated or write-protected
- Every source becomes a summary page before influencing topics
- All generated metadata (registry, backlinks, index, logs) is rebuilt after each agent turn
- Page links use folder-qualified wikilinks ([[topics/example]]) and citation-style source references ([[summaries/id|SRC-id]])
- The wiki root is discovered by walking upward from cwd and checking for .wiki/config.json, with fallback to Wiki/ or wiki/ subdirectories
