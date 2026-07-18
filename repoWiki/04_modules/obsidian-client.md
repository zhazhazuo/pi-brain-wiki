# obsidian-client

## Responsibility

Unix socket client for the Obsidian CLI daemon. Provides a typed API surface for all Obsidian CLI commands — file read/write, search, backlinks, property management, template operations, and file/folder listing. Handles connection lifecycle, timeout management, and error normalization.

## Entry Points

- `extensions/brain-wiki/src/obsidian-client.ts` → `ObsidianClient` class — constructor takes vaultCwd and optional config

## Key Files

- `extensions/brain-wiki/src/obsidian-client.ts` → socket connection, command execution, response parsing
- `extensions/brain-wiki/src/obsidian-io.test.ts` → integration tests using the client
- `extensions/brain-wiki/src/types.ts` → `ObsidianClientConfig`, `BacklinkResult`, `SearchHit`

## Constraints

- Default socket path: `~/.obsidian-cli.sock`
- Default timeout: 10 seconds
- All commands are newline-delimited JSON over the socket
- CLI errors detected by `^Error:` prefix in raw response
- Supports: `read`, `create`, `move`, `rename`, `delete`, `search`, `backlinks`, `property:get/set/add/remove/list`, `template:list/read`, `files`, `folders`

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/obsidian-client.ts` | Socket connection, command exec, JSON/line/scalar parsing |
| Consumer | `extensions/brain-wiki/src/obsidian-io.ts` | Higher-level markdown/property IO boundary |
| Consumer | `extensions/brain-wiki/src/frontmatter.ts` | Delegates page writes when client provided |
| Consumer | `extensions/brain-wiki/src/search.ts` | Uses client for vault-wide search |
| Consumer | `extensions/brain-wiki/src/graph.ts` | Uses client for graph discovery commands |
| Consumer | `extensions/brain-wiki/src/triage.ts` | Uses client for LIST.md mutations |
