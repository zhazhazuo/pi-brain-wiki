# Module: task-sync

## Responsibility

Bidirectional LIST.md ↔ Taskwarrior sync: mark promoted items, sync completed tasks back to LIST.md.

## Entry Points

- extensions/brain-wiki/src/task-sync.ts → `findListItem()`, `markListItemPromoted()`, `markListItemDone()`, `syncCompletedTasksToList()`

## Key Files

- extensions/brain-wiki/src/task-sync.ts → all sync logic
- extensions/brain-wiki/src/task-sync.test.ts → unit tests for sync, marking, and completion

## Constraints

- `findListItem` indexing must match `scanListMdItems` exactly (resets per date, counts every checkbox line)
- `[>]` is the promoted marker; `[x]` is the done marker
- `source:` annotation format must be `LIST.md:YYYY-MM-DD:item-N`
- `markListItemPromoted` and `markListItemDone` use Obsidian IO when available, otherwise direct fs
- `syncCompletedTasksToList` is safe to run repeatedly (idempotent: `[x]` is already `[x]`)

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/task-sync.ts | `findListItem`, `markListItemPromoted`, `markListItemDone`, `getTasksWithListSource`, `syncCompletedTasksToList` |
| Consumer | extensions/brain-wiki/index.ts | `handleWikiTaskAction` calls `markListItemPromoted` after promote; `wiki_task_scan` and `wiki_week` call `syncCompletedTasksToList` |
| Consumer | extensions/brain-wiki/src/task-scan.ts | `scanListMdItems` skips `[>]` items (promoted) in addition to `[x]` |
