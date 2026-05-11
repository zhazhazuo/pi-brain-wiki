# Module: project-sync

## Responsibility

Syncs with Project/ folders — create weekly project notes, scan, add notes, suggest tasks.

## Entry Points

- extensions/brain-wiki/src/project-sync.ts → main entry, exported syncProject()

## Key Files

- extensions/brain-wiki/src/project-sync.ts → all project sync logic

## Constraints

- create_project title rule → `wNN-Project Title` where `NN` is the zero-padded ISO week number
- create_project path rule → `Project/wNN-Project Title/wNN-Project Title.md`
- Requires project for create_project action
- Requires project and content for add_note action
- Requires content for suggest_task action
- AI notes use `> 🤖 [AI]` prefix
- Parses frontmatter from project index.md for status metadata

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/project-sync.ts | syncProject(): scan/create_project/add_note/suggest_task actions |
| Consumer | extensions/brain-wiki/index.ts | wiki_project_sync tool handler calls syncProject() |
