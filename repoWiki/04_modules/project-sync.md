# Module: project-sync

## Responsibility

Owns deterministic `Project/` workflows — create four-file project folders, scan/review canonical project state, mutate project metadata, manage structured task queues, append timeline history, and promote qualifying tasks to `LIST.md`.

## Entry Points

- extensions/brain-wiki/src/project-sync.ts → main entry, exported syncProject()
- extensions/brain-wiki/index.ts → `wiki_project_sync` tool registration and result formatting

## Key Files

- extensions/brain-wiki/src/project-sync.ts → action router, project mutations, review logic, and LIST promotion
- extensions/brain-wiki/src/project-schema.ts → project template builder and frontmatter validation
- extensions/brain-wiki/src/project-tasks.ts → structured task parser, task id allocation, and block updates
- extensions/brain-wiki/src/project-timeline.ts → typed timeline entry formatter

## Constraints

- create_project title rule → `wNN-Project Title` where `NN` is the zero-padded ISO week number
- create_project path rule → `Project/wNN-Project Title/`
- create_project required files → `project.md`, `tasks.md`, `timeline.md`, `notes.md`
- canonical project file → `project.md`; scan reads it first, then same-named project file, then `index.md`, `PROJECT.md`, `README.md`
- scan skips `Project/PROJECTS.md`
- canonical status set → `idea`, `active`, `waiting`, `blocked`, `done`, `archived`
- review action is read-only; reports counts for `idea`/`active`/`waiting`/`blocked`/`done`/`archived`, missing `next_action`, blocked projects, and archive candidates
- `set_status` rejects invalid statuses and appends a `status_change` timeline entry
- `set_next_action` rejects empty next actions and appends a `decision` timeline entry
- `set_deadline`, `link_resource`, and `relate` rewrite `project.md` through normalized frontmatter serialization
- `timeline_append` is append-only for agent behavior
- task ids are deterministic → `TASK-001`, `TASK-002`, ...
- `task_update`, `task_block`, and `task_close` mutate structured task blocks by id
- `task_promote` only writes to `LIST.md` when cross-project / urgent / coordination criteria pass
- project frontmatter normalization preserves wikilinks as scalar or flat list values
- `next_action` is preferred; `last_action` remains fallback-compatible for scan/review
- all project/task/timeline mutations require Obsidian CLI and fail closed without a client
- Requires project for create_project action
- Requires project and content for add_note action
- Requires content for suggest_task action
- Requires project and content for all mutation actions
- AI notes use `> 🤖 [AI]` prefix
- Parses frontmatter from project main files for status metadata
- Uses `gray-matter` parsing/serialization for canonical project writes

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/project-sync.ts | syncProject(): scan/review/create_project/add_note/suggest_task plus project/task/timeline mutation actions |
| Implementation | extensions/brain-wiki/src/project-schema.ts | deterministic four-file template + project frontmatter validation |
| Implementation | extensions/brain-wiki/src/project-tasks.ts | parse/render/update structured task blocks and allocate stable ids |
| Implementation | extensions/brain-wiki/src/project-timeline.ts | render typed timeline entries |
| Consumer | extensions/brain-wiki/index.ts | wiki_project_sync exposes the full project action surface and formats scan/review/mutation results |
