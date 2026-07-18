# context-guide

## Responsibility

Formats human-readable and agent-readable catalog entries for configured external contexts. Provides lookup helpers to match a PKB note path to its corresponding context configuration, and generates access hints for wiki tools and graph/status output.

## Entry Points

- `extensions/brain-wiki/src/context-guide.ts` → `listConfiguredContexts()` — enumerate all configured contexts
- `extensions/brain-wiki/src/context-guide.ts` → `findContextForPkbNote()` — match a PKB note path to its context
- `extensions/brain-wiki/src/context-guide.ts` → `formatExternalContextCatalog()` — render full catalog for agents

## Key Files

- `extensions/brain-wiki/src/context-guide.ts` → catalog listing, PKB note matching, hint formatting
- `extensions/brain-wiki/src/context-guide.test.ts` → unit tests for normalization and matching
- `extensions/brain-wiki/src/types.ts` → `ExternalContextConfig`, `ContextGatherIntent`

## Constraints

- PKB note matching normalizes backslashes, leading `./`, and trailing `/`
- Matches with and without `.md` extension
- Catalog sorted alphabetically by label
- `formatExternalContextHints()` returns empty string when no contexts configured
- `formatResolveNextSteps()` produces concrete `wiki_context_resolve` call examples

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/context-guide.ts` | Catalog formatting, PKB note path matching, access hint generation |
| Consumer | `extensions/brain-wiki/src/graph.ts` | Appends context hints to graph search/traverse/bridge output |
| Consumer | `extensions/brain-wiki/src/context-gather.ts` | Uses `findContextForPkbNote()` for PKB-backed resolution |
| Consumer | `extensions/brain-wiki/index.ts` | Uses `listConfiguredContexts()` for `wiki_context_list` tool |
