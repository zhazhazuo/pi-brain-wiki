# project-tasks

## Responsibility

Parses, renders, and updates structured task blocks within a project's `tasks.md` file. Manages deterministic task ID allocation (`TASK-001` format), status transitions, and block-level CRUD operations on the markdown task list.

## Entry Points

- `extensions/brain-wiki/src/project-tasks.ts` → `parseTaskBlocks()` — extract all task records from markdown
- `extensions/brain-wiki/src/project-tasks.ts` → `appendTaskBlock()` — add a new task to the markdown
- `extensions/brain-wiki/src/project-tasks.ts` → `updateTaskBlock()` — mutate a specific task by ID

## Key Files

- `extensions/brain-wiki/src/project-tasks.ts` → parser, renderer, ID allocator, block updater
- `extensions/brain-wiki/src/project-sync.ts` → orchestrator that reads/writes tasks.md through these functions

## Constraints

- Task IDs are `TASK-NNN` format, zero-padded to 3 digits
- `nextTaskId()` scans existing IDs and allocates highest + 1
- Status values: `open`, `in_progress`, `blocked`, `done`
- Priority values: `low`, `medium`, `high`
- `depends_on` and `links` are list fields; `owner` and `due` are optional scalars
- `updateTaskBlock()` throws if task ID not found

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/project-tasks.ts` | Task block parser, renderer, ID allocator, updater |
| Consumer | `extensions/brain-wiki/src/project-sync.ts` | Reads/writes tasks.md for task mutations and promotion |
