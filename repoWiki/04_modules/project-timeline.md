# project-timeline

## Responsibility

Formats append-only typed timeline entries for a project's `timeline.md` file. Each entry has a timestamp, type (created, status_change, note, task_added, task_closed, linked), and a description line.

## Entry Points

- `extensions/brain-wiki/src/project-timeline.ts` → `formatTimelineEntry()` — render a single timeline entry as markdown

## Key Files

- `extensions/brain-wiki/src/project-timeline.ts` → entry formatter
- `extensions/brain-wiki/src/project-sync.ts` → appends timeline entries during project and task mutations

## Constraints

- Entries are append-only — never modified or deleted
- Format: `- [ISO-timestamp] TYPE: description`
- Valid types: `created`, `status_change`, `note`, `task_added`, `task_closed`, `linked`
- Timestamps use ISO 8601 format

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/project-timeline.ts` | Timeline entry formatter |
| Consumer | `extensions/brain-wiki/src/project-sync.ts` | Appends entries during project creation, status changes, task operations |
