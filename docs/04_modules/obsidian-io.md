# Module: obsidian-io

## Responsibility

Obsidian-facing IO boundary for markdown reads/writes, page serialization writes, appends/prepends, and property updates.

## Entry Points

- extensions/brain-wiki/src/obsidian-io.ts → toObsidianPath(), writeMarkdown(), writeMarkdownPage(), setMarkdownProperty()

## Key Files

- extensions/brain-wiki/src/obsidian-io.ts → converts absolute paths to vault-relative CLI paths and delegates writes/properties to ObsidianClient
- extensions/brain-wiki/src/obsidian-client.ts → Unix socket protocol client used by the boundary

## Constraints

- Vault-visible writes use ObsidianClient create/append/prepend/property:set
- CLI errors propagate to callers instead of silently falling back to filesystem writes
- Raw filesystem remains only for callers that omit a client, mainly tests or internal/non-vault paths

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/obsidian-io.ts | Obsidian path conversion and markdown/property IO helpers |
| Consumer | extensions/brain-wiki/src/frontmatter.ts | Delegates writePage() and setPageProperty() to Obsidian IO when a client is provided |
| Consumer | extensions/brain-wiki/src/capture.ts | Writes extracted markdown, manifest JSON, and summary pages through Obsidian IO |
| Consumer | extensions/brain-wiki/src/triage.ts | Reads/appends/writes LIST.md through Obsidian IO when a client is provided |
| Consumer | extensions/brain-wiki/src/project-sync.ts | Reads project indexes and writes project notes/LIST.md through Obsidian IO |
