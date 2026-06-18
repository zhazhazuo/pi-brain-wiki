# Deterministic Project Process Design

Date: 2026-06-18
Repository: `pi-brain-wiki`
Scope: Project operating model for shared Human/Agent work in `Project/`, with deterministic mutation paths enforced by scripts and skills.

## Goal

Define a deterministic, Obsidian-native project process where:

- `Project/` is the canonical shared workspace for humans and agents
- agents mutate project state only through validated commands or skills
- `Wiki/` remains agent-owned and derived; humans are not required to participate there
- project notes stay connected to the broader Obsidian graph through wikilinks
- project execution, review, and sync can be automated without freeform agent behavior

## Current Context

The current repository already has a partial project workflow:

- `wiki_project_sync` supports `scan`, `review`, `create_project`, `add_note`, and `suggest_task`
- `LIST.md` and `Project/` are shared human/agent zones
- `Area/` is human-only and protected from agent writes
- project review already uses `next_action`-style metadata

This design extends that model into a full deterministic project operating system rather than replacing it.

## Non-Goals

- Turning `Wiki/` into a human-facing source of truth
- Supporting arbitrary folder/file layouts inside `Project/`
- Allowing freeform agent edits to canonical project state
- Replacing human judgment on project content or priorities
- Building a full PM suite with estimates, swimlanes, or dependency graphs before the core process is stable

## Design Principles

1. `Project/` is canonical
   Human and agent collaboration happens in `Project/`, not in `Wiki/`.

2. Determinism over convenience
   Agents must use constrained commands/skills for state mutations rather than direct freeform edits.

3. Obsidian-native graph behavior
   Project notes must participate in the vault graph via wikilinks, not behave like isolated folders.

4. Separate current state from historical record
   `project.md` stores current truth; `timeline.md` stores append-only history.

5. Local execution, central awareness
   Each project owns its own task queue; central views such as `LIST.md` surface only promoted or cross-project work.

## Recommended Approach

Use a frontmatter-first project control model:

- canonical project state lives in `Project/<project-slug>/project.md`
- a fixed file set is required for every project
- all agent mutations happen through validated commands/skills
- timeline/history is append-only
- central wiki/brain views are derived from `Project/` and linked resources

Alternatives rejected:

- control-file-first under `Wiki/` or `meta/`
  Rejected because it conflicts with `Project/` as the shared canonical workspace.

- single-file project model
  Rejected because state, tasks, notes, and history become mixed and hard to validate.

## Project Folder Template

Every project must use this required structure:

```text
Project/<project-slug>/
├── project.md
├── tasks.md
├── timeline.md
└── notes.md
```

### File Roles

#### `project.md`

Canonical current state and metadata for the project.

#### `tasks.md`

Canonical project-local task queue. This is the primary operational queue for the project.

#### `timeline.md`

Append-only dated history of milestones, state changes, decisions, risks, reviews, and handoffs.

#### `notes.md`

Working notes, research synthesis, meeting notes, and intermediate thinking.

## Obsidian-Native Rules

The project folder is not an isolated unit. It is an operational home within a larger graph.

### Required link behavior

- every required file must contain meaningful outbound wikilinks, except a brand-new project immediately after creation
- `project.md` links to relevant `Area/`, `Resource/`, people, systems, and related project pages
- `tasks.md` links tasks to the project page and any relevant notes/resources when applicable
- `timeline.md` links each event to its cause, evidence, or related artifact when available
- `notes.md` links back to `project.md` and outward to connected knowledge

### External input policy

- outside inputs should live in `Resource/` or as external links
- `Project/` should reference those inputs rather than copy them in bulk
- `Wiki/` may later synthesize those inputs, but human participation in `Wiki/` is not required

## Canonical State Model

`project.md` is the canonical current state page.

### Required frontmatter

```yaml
type: project
title: <string>
status: idea | active | waiting | blocked | done | archived
created: YYYY-MM-DD
updated: YYYY-MM-DD
area: <wikilink-or-string>
priority: low | medium | high
deadline: YYYY-MM-DD | ""
next_action: <string>
review_after: YYYY-MM-DD | ""
resources:
  - <wikilink-or-url>
related_projects:
  - <wikilink>
tags:
  - project
```

### Required body sections

```md
## Outcome

## Current State

## Next Action

## Active Links
```

### State rules

- `next_action` is required unless status is `done` or `archived`
- `updated` must change on every successful agent mutation
- `resources` should point to `Resource/` pages or external links
- `related_projects` should use wikilinks when project overlap or dependency exists
- if status changes to `blocked` or `waiting`, the reason must also be recorded in `timeline.md`
- agents may update only validated fields and known sections; they may not rewrite arbitrary project structure

## Status Model

Every project uses the same fixed status set:

- `idea` = captured but not started
- `active` = currently being worked
- `waiting` = pending external input or dependency
- `blocked` = cannot proceed without intervention
- `done` = outcome achieved, ready to close
- `archived` = closed and no longer active

This fixed set is intentionally small so scripts and skills can validate it deterministically.

## Task Model

`tasks.md` is the canonical project task queue.

### Task requirements

Every task should be machine-readable and markdown-readable, with at least:

- stable task id
- status
- priority
- created date
- optional due date
- optional owner
- optional depends-on / blocked-by
- links

### Recommended task format

Use one structured block per task, not loose checkboxes alone. Example:

```md
## Open

### TASK-001
- status: open
- priority: high
- created: 2026-06-18
- due: 2026-06-25
- owner: agent
- depends_on:
  - [[Project/example/project]]
- links:
  - [[Project/example/project]]
  - [[Resource/example-input]]
- summary: Draft deterministic project command surface
```

Exact syntax may change during implementation, but the key constraint is that a parser can validate and update tasks deterministically.

### Task rules

- `tasks.md` is the primary queue for work inside a project
- agents may add, update, reorder, or close tasks only via constrained commands/skills
- humans may edit directly if needed
- central views may derive from tasks, but must not overwrite project-local truth

## Timeline Model

`timeline.md` is append-only for agent behavior.

### Entry rules

- every entry is dated
- every state-changing agent command appends a timeline entry automatically
- entries should link to the note, task, resource, or artifact that caused the event when available
- old entries are never rewritten or deleted by agents

### Supported event types

- `status_change`
- `decision`
- `milestone`
- `risk`
- `handoff`
- `review`

This keeps `timeline.md` as a reliable log, while `project.md` holds the current state.

## Notes Model

`notes.md` is freeform but still bounded.

### Notes rules

- agents may append or insert within known note sections
- notes should prefer linking to existing pages over repeating source content
- if a note materially changes project state, that state must still be updated through constrained commands, not inferred from prose alone

## Central Brain and Sync Model

### Source-of-truth boundaries

- `Project/` = canonical shared project workspace
- `LIST.md` = central coordination surface, not primary project queue
- `Wiki/` = derived synthesis/discovery layer, agent-owned
- `Resource/` = storage for external inputs and reference material

### `LIST.md` role

`LIST.md` should only hold:

- cross-project tasks
- today/this-week focus items
- coordination items
- escalations from blocked or waiting projects

It should not duplicate the entire contents of every `tasks.md`.

### Sync rhythm

#### Per mutation

Each successful state mutation should perform:

1. validate command input
2. apply the permitted update to `project.md` or `tasks.md`
3. append a related `timeline.md` entry
4. update derived metadata

#### Daily or on-demand

Run a project queue scan to surface:

- due tasks
- overdue tasks
- blocked tasks
- stale projects missing movement

#### Weekly

Run a portfolio review across `Project/` to identify:

- active projects missing `next_action`
- overdue deadlines
- blocked/waiting projects needing escalation
- stale active projects
- archive candidates

#### Periodic brain sync

Generate or refresh derived intelligence views from:

- `Project/` state
- task queues
- linked `Resource/` pages
- vault graph activity

## Command Surface

Agents must use a constrained command surface for all canonical mutations.

### Project commands

- `project create`
  Create folder and required files from template.

- `project set-status`
  Update `status`, `updated`, and append `timeline.md`.

- `project set-next-action`
  Update `next_action`, `updated`, and optionally `review_after`.

- `project set-deadline`
  Update deadline-related fields.

- `project link-resource`
  Add validated `Resource/` link or external URL to `resources`.

- `project relate`
  Add related project wikilinks.

- `project review`
  Read-only review of project completeness and current health.

### Task commands

- `project task-add`
- `project task-update`
- `project task-close`
- `project task-block`
- `project task-promote`
  Promote a project task to `LIST.md` only when it meets central-visibility criteria.

### Timeline commands

- `project timeline-append`
  Append a dated event with type validation.

### Sync/review commands

- `project scan`
  Portfolio-level scan across `Project/`.

- `project weekly-review`
  Deterministic weekly review across all projects.

- `project sync-brain`
  Refresh derived wiki/intelligence surfaces from canonical project state.

## Skill Surface

In addition to scripts, the process should use skills as policy wrappers:

- a `project-operator` skill for allowed mutation workflows
- a `project-review` skill for weekly and portfolio review
- a `project-intake` skill for turning `Resource/` inputs into project actions

These skills should:

- prefer the command surface over direct edits
- reject mutations that bypass required validation
- require link completion when graph connectivity is missing
- enforce append-only behavior for timeline operations

## Validation Rules

Validation should fail closed for agent operations.

### Folder validation

- required files exist
- file names match expected template

### Frontmatter validation

- required fields present
- enum fields valid
- dates parse correctly
- `next_action` present when required

### Graph validation

- required files contain minimum outbound links after initial creation grace period
- resource references point to existing `Resource/` pages or valid URLs
- related project links resolve

### Task validation

- stable ids are unique within project
- statuses/priorities valid
- dependencies reference known task ids or valid linked pages

### Timeline validation

- new entries are appended only
- event types valid
- status transitions are mirrored in timeline

## Error Handling

For agent commands:

- reject partial invalid mutations
- return concrete validation errors
- do not silently repair semantic mistakes
- where safe, offer a deterministic remediation path such as “missing `next_action`; run `project set-next-action`”

For human edits:

- allow non-conforming edits to exist temporarily
- surface them during `project review` and `project weekly-review`
- provide a repair command rather than blocking human work

## Rollout Plan

### Phase 1

- define canonical file template
- define frontmatter schema
- define task schema
- add validation and read-only review

### Phase 2

- add constrained mutation commands for project/task/timeline operations
- update current `wiki_project_sync` to route through those commands

### Phase 3

- add central review and promotion rules for `LIST.md`
- add derived brain sync views into `Wiki/`

### Phase 4

- add richer graph validation and project health scoring if still needed

## Testing Strategy

### Unit tests

- frontmatter validation
- task parser/serializer
- timeline append behavior
- status transition validation
- link validation rules

### Integration tests

- `project create` produces valid folder structure
- `project set-status` updates `project.md` and appends `timeline.md`
- `project task-promote` updates `LIST.md` only when allowed
- `project weekly-review` flags missing `next_action`, stale active projects, and archive candidates

### Behavioral tests

- agents cannot mutate canonical files except through allowed commands
- direct freeform mutation attempts are rejected or flagged
- Obsidian-native link requirements are enforced after creation grace period

## Open Implementation Decisions

These are intentionally deferred to planning, not left ambiguous:

- exact parser format for structured tasks in `tasks.md`
- command naming and whether they live under `wiki_project_sync` or a new dedicated tool
- whether central review outputs should live only in tool results or also in generated markdown views

The design direction is fixed even though these implementation details remain to be chosen during planning.

## Recommendation Summary

Adopt a deterministic frontmatter-first project process where:

- `Project/` remains the shared canonical workspace
- every project uses a fixed four-file template
- agents mutate state only through validated commands/skills
- `tasks.md` is the canonical local queue
- `timeline.md` is append-only history
- `LIST.md` is a central coordination surface, not the primary project queue
- `Wiki/` remains derived and agent-owned
- Obsidian links are mandatory so project notes remain part of the vault graph
