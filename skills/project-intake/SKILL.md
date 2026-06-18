---
name: project-intake
description: Use when turning Resource/ inputs into project actions. Creates projects or links resources without direct file edits.
---

# Project Intake

Turn `Resource/` inputs into deterministic project actions through `wiki_project_sync`.

## Intake Flow

1. Scan or review existing projects (`scan`, `review`)
2. Create a new project if none exists (`create_project`)
3. Link the resource (`link_resource`)
4. Add an initial note or task (`add_note`, `task_add`)
5. Set status and next action (`set_status`, `set_next_action`)

## Rules

- External inputs stay in `Resource/`; projects reference them via wikilinks
- New projects get the four-file template (`project.md`, `tasks.md`, `timeline.md`, `notes.md`)
- Do not copy resource content into project files — link instead
