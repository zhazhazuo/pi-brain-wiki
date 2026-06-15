# Module: search

## Responsibility

Queries the compiled page registry with keyword matching, scoring, and ranking. Also routes vault-wide discovery through Obsidian CLI when `scope: "vault"` is used. Returns structured search results by title, alias, headings, summary, tags, and source IDs.

## Entry Points

- extensions/brain-wiki/src/search.ts → searchRegistry()

## Key Files

- extensions/brain-wiki/src/search.ts → all search logic

## Constraints

- Searches the pre-built registry.json — does not scan files directly
- Supports `scope: "vault"` via Obsidian CLI search before falling back to registry-backed wiki lookup
- Both registry and vault search are keyword-based; they do not infer semantic "AI relevance"
- Pages must expose matching titles, aliases, summaries, headings, tags, or source IDs to rank
- Results are scored and ranked by relevance
- Default result limit is configured in wiki config (default 10)
- Supports filtering by page type (summary, topic, plan, review)

## Lifecycle Filtering

Search excludes `archived` and `cleared` entries by default. Set `includeArchived: true` to include them.

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/search.ts | searchRegistry(): loads registry.json, scores matches, returns ranked results; searchViaObsidian(): routes scope=vault through Obsidian CLI |
| Consumer | extensions/brain-wiki/index.ts | wiki_search tool handler calls searchViaObsidian() |
