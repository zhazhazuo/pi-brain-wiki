---
name: project-operator
description: Use when mutating project state in Project/ folders. Routes all writes through wiki_project_sync validated commands.
---

# Project Operator

Use `wiki_project_sync` for all project state mutations. Do not directly edit `project.md`, `tasks.md`, or `timeline.md`.

## Preferred Commands

| Action | When to use |
|--------|-------------|
| `set_status` | Change project lifecycle state (idea → active → blocked → done) |
| `set_next_action` | Update the canonical next action link |
| `task_add` | Append a structured task block to `tasks.md` |
| `task_update` | Modify an existing task record |
| `task_promote` | Promote a task to LIST.md when gating rules pass |

## Rules

- Each project lives in `Project/<week-slug>/` with four required files: `project.md`, `tasks.md`, `timeline.md`, `notes.md`
- `project.md` is canonical current state; `timeline.md` is append-only history
- Pass mutation payloads as JSON in the `content` parameter
- Use Obsidian wikilinks for cross-references (`[[Resource/...]]`, `[[Project/...]]`)
