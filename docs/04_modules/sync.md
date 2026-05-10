# Module: sync

## Responsibility

Bootstraps wiki topic pages from PARA vault folders (Area/, Resource/, Project/). Run once during setup, then again only when new PARA folders are added. After initial sync, the agent builds Wiki organically from discussions and sources.

## Entry Points

- extensions/brain-wiki/src/sync.ts → syncParaToWiki()

## Key Files

- extensions/brain-wiki/src/sync.ts → all sync logic

## Constraints

- Scope can be area, resource, projects, or all
- Uses ObsidianClient if available, falls back to filesystem
- Creates topic pages for areas/resources, plan pages for projects
- Writes `last_synced` and `para_source` to topic frontmatter
- Writes `meta/sync-state.json` with `last_full_sync` timestamp

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/sync.ts | syncParaToWiki(): scans PARA folders, calls ensureCanonicalPage(), updates last_synced/para_source frontmatter, writes meta/sync-state.json |
| Consumer | extensions/brain-wiki/index.ts | wiki_sync tool handler calls syncParaToWiki() |
| Consumer | extensions/brain-wiki/src/lint.ts | lintStaleSync() reads last_synced/para_source to flag stale topics |
