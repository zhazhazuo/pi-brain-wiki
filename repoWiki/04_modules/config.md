# Module: config

## Responsibility

Loads, creates, and writes .wiki/config.json with merged defaults. Defines the WikiConfig type. Also normalizes the external `contexts` registry and loads untracked `.wiki/env.local.json` for machine-local repo paths.

## Entry Points

- extensions/brain-wiki/src/config.ts → loadConfig(), writeDefaultConfig(), hasWikiConfig(), loadLocalEnvConfig(), writeLocalEnvExample()

## Key Files

- extensions/brain-wiki/src/config.ts → all config logic, `contexts` normalization, local env loading
- .wiki/env.local.example.json → checked-in template for per-machine repo-key mappings

## Constraints

- Config is merged with hardcoded defaults — partial configs are valid
- Version field in config enables future migration
- Config must be written before any other vault operation
- External context registry lives in `WikiConfig.contexts` (keyed by stable context id)
- Machine-local repo paths map via `repo_key` in `.wiki/env.local.json` (untracked)
- Malformed context entries are dropped during normalization

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/config.ts | loadConfig(): reads and merges with defaults; writeDefaultConfig(): creates .wiki/config.json from scratch; normalizeContexts(); loadLocalEnvConfig(); writeLocalEnvExample() |
| Consumer | extensions/brain-wiki/index.ts | tool handlers call loadConfig() after resolveWikiRoot() |
| Consumer | extensions/brain-wiki/src/scaffold.ts | bootstrapVault() calls writeDefaultConfig() and writeLocalEnvExample() |
| Consumer | extensions/brain-wiki/src/context-resolve.ts | reads `contexts` registry and local env for repo path resolution |
