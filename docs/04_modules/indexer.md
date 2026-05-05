# Module: indexer

## Responsibility

Builds and persists the wiki registry (registry.json), backlinks map (backlinks.json), and index page (index.md). Scans all pages, extracts frontmatter, and computes cross-links.

## Entry Points

- extensions/brain-wiki/src/indexer.ts → rebuildRegistryAndIndex()

## Key Files

- extensions/brain-wiki/src/indexer.ts → all indexing logic

## Constraints

- Registry is rebuilt from scratch on each scan — no incremental updates
- Backlinks are computed by scanning all pages for [[wikilinks]]
- Index page is regenerated from registry data
- Generated files are write-protected (listed in config.protect)

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/indexer.ts | rebuildRegistryAndIndex(): scans pages/, builds registry.json, backlinks.json, index.md |
| Consumer | extensions/brain-wiki/index.ts | called on agent-end via withRootLock to auto-rebuild after mutations |
| Consumer | extensions/brain-wiki/src/search.ts | reads registry.json for search queries |
