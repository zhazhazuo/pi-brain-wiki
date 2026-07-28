---
name: taskwarrior
description: Manages tasks via Taskwarrior CLI. Use when drafting new tasks from plain-words descriptions, refreshing the weekly dashboard, or annotating and completing tasks.
---

# Taskwarrior Workflow

Taskwarrior is the shared temporal task database. The wiki treats it as a read-only data source plus a validated write endpoint. There is no link between Taskwarrior and LIST.md.

## Triggers

Load this skill when the user says:
- "make this a task" / "help me phrase this task" / "draft a task for X"
- "what's on this week" / "weekly view" / "refresh WEEK.md"
- "mark task done" / "complete this task"
- "annotate task" / "add note to task"

## Sub-files

| File | When to load |
|------|-------------|
| `instructions/creation-rules.md` | Before drafting any task. Project format, TYPE prefix, validation rules, agent write rules |
| `instructions/session-workflow.md` | Session start/end. Read-state → draft → confirm → add loop |

## Tools

| Tool | Action | Example |
|------|--------|---------|
| `wiki_task(action: "promote")` | Create validated task from a confirmed draft | `description`, `project`, `scheduled`, `priority`, `estimate`, `tags` required |
| `wiki_task(action: "annotate")` | Add note to task | `taskId`, `text` required |
| `wiki_task(action: "done")` | Complete task | `taskId` required |
| `wiki_week()` | Refresh WEEK.md | No params |

## Quick Reference

**Always:**
- Read real Taskwarrior state before drafting (`task export`, `task projects`, `task tags`)
- Validate all fields against `creation-rules.md` before proposing
- Propose the draft to Walker, never auto-create
- Chain split tasks with `depends:`

**Never:**
- Modify core fields without Walker's instruction
- Delete tasks
- Un-complete tasks
- Create unscheduled tasks
- Touch LIST.md — it is a plain inbox, not part of the task flow
