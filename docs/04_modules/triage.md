# Module: triage

## Responsibility

Manage LIST.md as shared routing center between human and agent.

## Entry Points

- extensions/brain-wiki/src/triage.ts → main entry, exported triageList()

## Key Files

- extensions/brain-wiki/src/triage.ts → all triage logic

## Constraints

- All AI content must use `> 🤖 [AI]` prefix
- Never mark items complete or delete items
- Content required for add action
- Parses date sections and task items from LIST.md

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/triage.ts | triageList() with read/add/suggest/flag_stale actions |
| Consumer | extensions/brain-wiki/index.ts | wiki_triage tool handler calls triageList() |
