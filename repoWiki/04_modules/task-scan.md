# task-scan

## Responsibility

Scans the vault for task promotion candidates. Analyzes LIST.md items, project metadata, and wiki meta to identify work that should become Taskwarrior tasks. Detects stale LIST.md items and proposes promotions based on age and content patterns.

## Entry Points

- `extensions/brain-wiki/src/task-scan.ts` → `scanForPromotableItems()` — scan LIST.md and projects for promotion candidates

## Key Files

- `extensions/brain-wiki/src/task-scan.ts` → LIST.md staleness detection, promotion proposal generation
- `extensions/brain-wiki/src/task-scan.test.ts` → unit tests for scanning logic
- `extensions/brain-wiki/src/task-validator.ts` → validates promotion payloads before proposal

## Constraints

- Scans LIST.md items older than a configurable staleness threshold
- Only suggests promotions for items with sufficient detail (description, project)
- Does not auto-promote — produces proposals for agent or user approval
- Integrates with `task-validator` for pre-validation of proposed tasks

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/task-scan.ts` | Staleness detection, promotion proposal generation |
| Consumer | `extensions/brain-wiki/index.ts` | Wires `wiki_task_scan` tool handler |
| Consumer | `extensions/brain-wiki/src/task-validator.ts` | Validates proposed promotions |
