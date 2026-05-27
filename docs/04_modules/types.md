# Module: types

## Responsibility

Defines all shared TypeScript interfaces, types, and enums used across the extension. Acts as the single source of truth for data shapes (WikiConfig, ParsedPage, RegistryData, WikiEvent, tool parameters, etc.).

## Entry Points

- extensions/brain-wiki/src/types.ts → all type exports

## Key Files

- extensions/brain-wiki/src/types.ts → all type definitions

## Constraints

- Imported by every other module — must be kept stable and backwards compatible
- No implementation logic — types only
- Tool parameter schemas are defined inline in index.ts using @sinclair/typebox, not in types.ts

## Lifecycle Types

| Type | New Fields |
|------|-----------|
| `SourceManifest.status` | Added `"consumed"` and `"cleared"` |
| `WikiEventKind` | Added `"consumed"`, `"archived"`, `"cleared"` |
| `RegistryEntry` | Added `consumedAt?`, `pkbRefs?` |
| `StatusSummary.sources` | Added `consumed`, `archived`, `cleared` |
| `LifecycleBacklog` | Interface for activity scan backlog data |

## LIST.md Types

| Type | Fields |
|------|--------|
| `ListItemCategory` | `"source" | "task" | "idea" | "meeting-note" | "plan" | "unknown"` |
| `ListItem` | `date`, `text`, `done`, `inProgress`, `category`, `agentNotes[]`, `daysSinceCreation` |
| `ListMdData` | `items[]`, `unprocessedItems[]`, `oldestUnprocessedDate`, `unprocessedSourceUrls[]` |

## Project Sync Types

| Type | Fields |
|------|--------|
| `ProjectSyncAction` | includes `scan`, `review`, `create_project`, `add_note`, `suggest_task` |
| `ProjectSyncResult.projects[]` | adds `mainPath`, `nextAction`, keeps `lastAction` fallback |
| `ProjectSyncResult.review` | status counts, missing next actions, archive candidates |

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/types.ts | WikiConfig, ParsedPage, RegistryData, WikiEvent, WikiPageType, CanonicalPageType, StatusSummary, EnsurePageParams/Result, etc. |
| Consumer | extensions/brain-wiki/src/*.ts | all source files import types from here |
