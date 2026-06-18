# Module: config

## Responsibility

Loads, creates, and writes .wiki/config.json with merged defaults. Defines the WikiConfig type.

## Entry Points

- extensions/brain-wiki/src/config.ts → loadConfig(), writeDefaultConfig(), hasWikiConfig()

## Key Files

- extensions/brain-wiki/src/config.ts → all config logic

## Constraints

- Config is merged with hardcoded defaults — partial configs are valid
- Version field in config enables future migration
- Config must be written before any other vault operation

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/config.ts | loadConfig(): reads and merges with defaults; writeDefaultConfig(): creates .wiki/config.json from scratch |
| Consumer | extensions/brain-wiki/index.ts | tool handlers call loadConfig() after resolveWikiRoot() |
| Consumer | extensions/brain-wiki/src/scaffold.ts | bootstrapVault() calls writeDefaultConfig() |
