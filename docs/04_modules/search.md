# Module: search

## Responsibility

Queries the compiled page registry with keyword matching, scoring, and ranking. Returns structured search results by title, alias, headings, summary, tags, and source IDs.

## Entry Points

- extensions/brain-wiki/src/search.ts → searchRegistry()

## Key Files

- extensions/brain-wiki/src/search.ts → all search logic

## Constraints

- Searches the pre-built registry.json — does not scan files directly
- Results are scored and ranked by relevance
- Default result limit is configured in wiki config (default 10)
- Supports filtering by page type (summary, topic, plan, review)

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/search.ts | searchRegistry(): loads registry.json, scores matches, returns ranked results |
| Consumer | extensions/brain-wiki/index.ts | wiki_search tool handler calls searchRegistry() |
