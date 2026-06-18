# Future Mode Project Review

## Overview

Adds retrieval-first project metadata handling to `wiki_project_sync`.
Project scan now reads future-mode project frontmatter, and review surfaces weekly control-panel gaps without mutating project state.

---

## Architecture

```mermaid
flowchart LR
    Policy[Future mode policy] --> Tool[wiki_project_sync]
    Tool --> Sync[syncProject]
    Sync --> Scan[Project metadata scan]
    Scan --> Review[Weekly review]
    Review --> Output[Project control summary]
```

---

## Key Files

| File | Role |
|------|------|
| `extensions/brain-wiki/index.ts` | Registers `wiki_project_sync` review action and formats scan/review output |
| `extensions/brain-wiki/src/project-sync.ts` | Scans project metadata, creates future-mode project pages, computes weekly review gaps |
| `extensions/brain-wiki/src/project-sync.test.ts` | Covers future-mode frontmatter creation, same-named project file scan, and review gaps |
| `extensions/brain-wiki/src/types.ts` | Adds `review`, `nextAction`, and `mainPath` fields to project sync contracts |
| `docs/ideas/future-mode.md` | Source policy for retrieval-first PARA project maintenance |

---

## Implementation Notes

- `create_project` keeps the existing `Project/wNN-Title/wNN-Title.md` path rule.
- Created projects seed `type`, `status`, `date`, `project`, `priority`, `deadline`, and `next_action`.
- Project scan reads same-named project files before fallback files: `index.md`, `PROJECT.md`, `README.md`.
- `next_action` is preferred; `last_action` remains a backward-compatible fallback.
- `review` is read-only: reports status counts, missing next actions, and completed projects that can be archived.
- `Project/PROJECTS.md` is skipped during project scan so the control panel is not treated as a project.

---

## Dependencies

- `obsidian-io` → reads/writes vault-visible project markdown through Obsidian CLI when available
- `paths` → resolves `Project/` and `LIST.md` from the wiki root
- `types` → exposes the extended project sync action/result contract
