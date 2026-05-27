Walker, guideline for future PKB maintenance:

## Core Rule

Organize for **retrieval**, not storage.

Before creating/moving/naming a note, ask:

> “Six months later, what will I know when I need this?”

Usually you will know one of:

1. type
2. time
3. topic
4. status

Your PKB should expose those four dimensions.

---

## Your Vault Model

Keep current structure:

```text
LIST.md      # command / task inbox
Project/     # active outcomes
Area/        # long-lived knowledge + responsibility
Resource/    # external/reference material
Archive/     # inactive/completed
Wiki/        # agent-managed synthesis layer
```

Do **not** copy the article’s folder structure directly.

---

## Where New Notes Go

### `Project/`

Use when there is:

- outcome
- deadline
- stakeholder
- next action
- completion state

Examples:

```text
Project/Sales Tool Data Center/
Project/HubSpot CMS/
Project/w22-CR Change Block POC/
```

### `Area/`

Use for stable knowledge or long-term responsibility.

Examples:

```text
Area/1 CS/
Area/3 Language/
Area/5 Work/
Area/8 Tool/
```

Stable concept notes should keep semantic names:

```text
Functional Programming.md
Obsidian.md
Sales Tool Data Center.md
English Grammar.md
```

Do **not** force date prefixes here.

### `Resource/`

Use for external or reusable reference:

- PRDs
- templates
- copied docs
- tool references
- skill docs
- raw material not yet internalized

### `Archive/`

Use when inactive, completed, or no longer relevant.

Do not delete unless obviously junk.

---

## Naming Rules

### Stable knowledge notes

Use clear semantic names:

```text
Obsidian.md
Functional Core Imperative Shell.md
HubSpot Module.md
```

### Event/capture notes

Use date prefix:

```text
2026-05-27-meeting-ben-ai-rtc.md
2026-05-27-progress-sales-tool-showcase.md
2026-05-27-reading-obsidian-retrieval-first.md
```

### Project subfiles

Generic names are fine **inside project folders**:

```text
tasks.md
notes.md
progress.md
open-questions.md
SPEC.md
```

Because the folder gives context.

---

## Required Metadata

### Project main file

```yaml
type: project
status: active
date: 2026-05-27
project: Sales Tool Data Center
priority: high
deadline: 2026-05-29
next_action: Prepare showcase script
```

### Project sub-note

```yaml
type: design
status: active
date: 2026-05-27
project: Sales Tool Data Center
```

### Area concept

```yaml
type: concept
status: reference
date: 2026-05-27
area: Computer Science
topic: functional-programming
```

### Resource

```yaml
type: article
status: reference
date: 2026-05-27
topic: obsidian
source: https://...
```

---

## Status Rules

Use only these unless needed:

```yaml
active      # currently used
waiting     # blocked / parked / backlog
reference   # stable knowledge or resource
complete    # finished project/meeting
archived    # inactive historical item
```

---

## Daily Habit

When capturing:

1. Put task/thought/link in `LIST.md`.
2. If it becomes work, create/update `Project/`.
3. If it becomes knowledge, integrate into `Area/`.
4. If it is external material, put in `Resource/` or capture through `Wiki/`.
5. Add metadata immediately.

Minimum metadata is enough:

```yaml
type:
status:
date:
topic/project/area:
```

---

## Weekly Habit

Open:

```text
Project/PROJECTS.md
```

Then update:

- `status`
- `next_action`
- `priority`
- `deadline`

Ask:

1. What is active?
2. What is waiting?
3. What should be complete?
4. What should be archived?
5. What has no next action?

---

## Monthly / Quarterly Habit

Run a review:

1. Check projects with stale `next_action`.
2. Archive completed projects.
3. Merge tiny duplicate notes.
4. Add metadata to Area notes you touched.
5. Create hub/MOC pages only when a topic has many notes.
6. Do not bulk-clean Area unless retrieval is actually painful.

---

## Important Rule

For moves/renames, use Obsidian CLI only:

```bash
obsidian move
obsidian rename
obsidian property:set
```

Never direct filesystem move/rename, because wikilinks may break.

---

## Practical Maxim

Your PKB should not be “perfectly organized.”

It should be:

> easy to capture, easy to retrieve, safe to evolve.

For you: keep PARA stable, add metadata gradually, and use `Project/PROJECTS.md` as the operational control panel.
