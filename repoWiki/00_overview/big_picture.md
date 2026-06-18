# Big Picture

## What the system does

A pi-coding-agent extension that turns a directory of markdown files into a structured, LLM-maintainable wiki with immutable source capture, generated metadata, linting, and wiki-maintenance skills.

## Core flow

pi agent session → wiki tools (capture/search/lint/ensure) → Obsidian CLI for vault-visible content + filesystem for internal .wiki/meta state

- `wiki_capture_source` — preserves a URL/file/text as an immutable packet in inbox/, creates a summary page in pages/summaries/
- `wiki_search` — queries Obsidian search context, then maps hits to the compiled registry
- `wiki_lint` — runs Obsidian graph checks for links/orphans plus wiki-specific frontmatter (including page-type conformance), coverage, and staleness checks
- `wiki_ensure_page` — creates canonical topic pages with deduplication through the Obsidian CLI
- `wiki_bootstrap` — initializes the vault directory structure, config, and templates
- Guard hooks — block `write`/`edit` on protected paths (inbox/, meta/), trigger auto-rebuild of generated metadata on agent end

## Constraints

- Never edit inbox/** or meta/** directly — those are generated or write-protected
- Vault-visible page/content/property mutations require a healthy Obsidian CLI client; internal .wiki/meta caches remain filesystem-backed
- Every source becomes a summary page before influencing topics
- All generated metadata (registry, backlinks, index, logs) is rebuilt after each agent turn
- Page links use folder-qualified wikilinks ([[topics/example]]) and citation-style source references ([[summaries/id|SRC-id]])
- The wiki root is discovered by walking upward from cwd and checking for .wiki/config.json, with fallback to Wiki/ or wiki/ subdirectories
