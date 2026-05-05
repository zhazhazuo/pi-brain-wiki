# Module: activity

## Responsibility

Scans vault and wiki activity for a given time period. Returns structured data about recent changes across wiki pages, PARA folders, and the inbox.

## Entry Points

- extensions/brain-wiki/src/activity.ts → scanActivity()

## Key Files

- extensions/brain-wiki/src/activity.ts → all activity scanning logic

## Constraints

- Scans both wiki (pages/, inbox/, meta/) and PARA (Resource/, Project/, Area/, Archive/, Draft/) directories
- Returns file-level change data with timestamps
- Default scan window is 7 days

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/activity.ts | scanActivity(): walks vault and PARA directories, filters by modification time, returns structured activity data |
| Consumer | extensions/brain-wiki/index.ts | wiki_scan_activity tool handler calls scanActivity() |
