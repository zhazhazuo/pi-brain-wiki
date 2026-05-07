# Module: sync

## Responsibility

Sync PARA vault folders (Area/, Resource/, Project/) into wiki topic pages.

## Entry Points

- extensions/brain-wiki/src/sync.ts → main entry, exported syncParaToWiki()

## Key Files

- extensions/brain-wiki/src/sync.ts → all sync logic

## Constraints

- Scope can be area, resource, projects, or all
- Uses ObsidianClient if available, falls back to filesystem
- Creates topic pages for areas/resources, plan pages for projects

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/sync.ts | syncParaToWiki() and scanParaFolders() |
| Consumer | extensions/brain-wiki/index.ts | wiki_sync tool handler calls syncParaToWiki() |
