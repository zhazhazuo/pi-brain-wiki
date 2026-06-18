# Module: project-sync

## Responsibility

Syncs with Project/ folders — create weekly project notes, scan/review future-mode metadata, add notes, suggest tasks.

## Entry Points

- extensions/brain-wiki/src/project-sync.ts → main entry, exported syncProject()

## Key Files

- extensions/brain-wiki/src/project-sync.ts → all project sync logic

## Constraints

- create_project title rule → `wNN-Project Title` where `NN` is the zero-padded ISO week number
- create_project path rule → `Project/wNN-Project Title/wNN-Project Title.md`
- create_project frontmatter → seeds `type`, `status`, `date`, `project`, `priority`, `deadline`, `next_action`
- scan reads same-named project file first, then `index.md`, `PROJECT.md`, `README.md`
- scan skips `Project/PROJECTS.md`
- review action is read-only; reports status counts, missing `next_action`, completed archive candidates
- `next_action` is preferred; `last_action` remains fallback-compatible
- `create_project`, `add_note`, and `suggest_task` require Obsidian CLI and fail closed without a client
- Requires project for create_project action
- Requires project and content for add_note action
- Requires content for suggest_task action
- AI notes use `> 🤖 [AI]` prefix
- Parses frontmatter from project main files for status metadata

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/project-sync.ts | syncProject(): scan/review/create_project/add_note/suggest_task actions |
| Consumer | extensions/brain-wiki/index.ts | wiki_project_sync tool handler calls syncProject() and formats scan/review output |
