---
name: project-review
description: Use for weekly or portfolio project review. Read-only inspection of project health, blocked work, and archive candidates.
---

# Project Review

Use `wiki_project_sync` with `action: "review"` or `action: "scan"` for read-only project inspection. Never mutate project files during review.

## Review Cadence

Run a portfolio review to surface:

- **Blocked** projects waiting on external input
- **No next action** — active, waiting, or blocked projects missing `next_action`
- **Stale active** — active projects not updated in 7+ days
- **Archive candidates** — projects with `status: done`

## Rules

- Review is read-only; propose mutations separately via `project-operator`
- Cross-check blocked projects against `Resource/` inputs
- Use `LIST.md` only for promotion, not as the canonical project record
