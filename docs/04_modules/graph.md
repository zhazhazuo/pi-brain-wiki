# Module: graph

## Responsibility

Vault graph discovery: search, neighborhood traversal, and PKB bridging through Obsidian CLI.

## Entry Points

- extensions/brain-wiki/src/graph.ts → main entry, exported graph discovery helpers

## Key Files

- extensions/brain-wiki/src/graph.ts → graph context search, traversal, and bridge rendering
- extensions/brain-wiki/src/graph.test.ts → unit tests for graph discovery and bridge output

## Constraints

- Requires Obsidian CLI for search, backlinks, properties, links, and page reads
- `findGraphContext` splits results into `wiki` and `pkb` zones
- `traverseNeighborhood` returns direct links/backlinks and optional second-hop neighbors
- `bridgeWikiPage` filters already-linked candidates before returning bridge suggestions
- `renderPkbContextBlock` emits `## PKB Context` blocks for seeded summary pages

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/graph.ts | `findGraphContext`, `traverseNeighborhood`, `bridgeWikiPage`, `buildEnsurePageGraphTerms`, `renderPkbContextBlock`, `formatGraphFind` |
| Consumer | extensions/brain-wiki/index.ts | registers `wiki_graph_find`, `wiki_graph_traverse`, and `wiki_graph_bridge` tools |
| Consumer | extensions/brain-wiki/src/capture.ts | seeds captured summary pages with PKB context blocks |
| Consumer | extensions/brain-wiki/src/scaffold.ts | seeds ensured canonical pages with PKB context blocks |
