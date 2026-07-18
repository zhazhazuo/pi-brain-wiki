# project-schema

## Responsibility

Defines the canonical `Project/` folder template structure and validates project frontmatter against required fields. Provides template strings for the four-file project set (project.md, tasks.md, timeline.md, notes.md) and frontmatter validation rules.

## Entry Points

- `extensions/brain-wiki/src/project-schema.ts` → `buildProjectTemplates()` — generate template content for a new project folder
- `extensions/brain-wiki/src/project-schema.ts` → `validateProjectFrontmatter()` — validate frontmatter against schema

## Key Files

- `extensions/brain-wiki/src/project-schema.ts` → template builders, frontmatter validator, status constants
- `extensions/brain-wiki/src/project-sync.ts` → consumes templates during project creation
- `extensions/brain-wiki/src/types.ts` → `ProjectStatus`, related types

## Constraints

- `type` must be `"project"`
- `status` must be one of: `active`, `waiting`, `blocked`, `planned`, `done`, `archived`
- `next_action` required when status is `active`, `waiting`, or `blocked`
- Templates include `${projectTitle}` placeholder for substitution
- Four-file set: `project.md`, `tasks.md`, `timeline.md`, `notes.md`

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/project-schema.ts` | Template strings, frontmatter validation, status constants |
| Consumer | `extensions/brain-wiki/src/project-sync.ts` | Uses `buildProjectTemplates()` for folder creation, `validateProjectFrontmatter()` for scan |
