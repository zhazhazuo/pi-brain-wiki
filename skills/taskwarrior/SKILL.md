---
name: taskwarrior
description: Manages tasks via Taskwarrior CLI. Use when promoting LIST.md items, scanning for stale work, refreshing the weekly dashboard, or anything involving task creation, annotation, or completion.
---

# Taskwarrior Workflow

Taskwarrior is the shared temporal task database. Both human and agent use the `task` CLI. Three extension tools handle the integration.

## Triggers

Load this skill when the user says:
- "promote this to taskwarrior" / "make this a task"
- "what's on this week" / "weekly view" / "refresh WEEK.md"
- "scan for stale work" / "what needs attention"
- "mark task done" / "complete this task"
- "annotate task" / "add note to task"
- "drain LIST.md" / "process the backlog"

## Sub-files

| File | When to load |
|------|-------------|
| `instructions/creation-rules.md` | Before promoting any task. Project format, TYPE prefix, validation rules, agent write rules |
| `instructions/session-workflow.md` | Session start/end. Scan→promote→refresh flow, LIST.md draining, bidirectional linking |

## Tools

| Tool | Action | Example |
|------|--------|---------|
| `wiki_task(action: "promote")` | Create validated task | `description`, `project`, `scheduled`, `priority`, `estimate`, `tags` required |
| `wiki_task(action: "annotate")` | Add note to task | `taskId`, `text` required |
| `wiki_task(action: "done")` | Complete task | `taskId` required |
| `wiki_task_scan(scope)` | Find stale work | `"all"`, `"list_md"`, `"projects"`, `"wiki_meta"` |
| `wiki_week()` | Refresh WEEK.md | No params |

## Quick Reference

**Always:**
- Validate all fields before `task add` (load `creation-rules.md`)
- Propose to Walker, never auto-create
- Chain split tasks with `depends:`
- Maintain bidirectional links (task ↔ wiki topic)

**Never:**
- Modify core fields without Walker's instruction
- Delete tasks
- Un-complete tasks
- Create unscheduled tasks
