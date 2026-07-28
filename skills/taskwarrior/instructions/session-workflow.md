# Session Workflow

## The loop: read state → draft → confirm → add

```
Session start (optional)
  └── wiki_week() → refresh the weekly dashboard

Format assist
  ├── 1. Read state: gather real context with read-only CLI
  │     - task projects                 → existing Domain.Outcome projects
  │     - task tags                     → the tag vocabulary in use
  │     - task export status:pending    → current load, scheduled patterns, estimates
  ├── 2. Draft: shape Walker's plain-words description per creation-rules.md
  │     - reuse an existing project when one fits; propose a new
  │       Domain.SpecificOutcome only when nothing matches
  │     - reuse existing tags; TYPE prefix → default tag mapping
  │     - present the full field set: description, project, scheduled,
  │       priority, estimate, tags (+ due/depends when relevant)
  ├── 3. Confirm: Walker approves or adjusts the draft
  └── 4. Add: wiki_task(action: "promote") with the confirmed fields

During session
  ├── Walker: "annotate task N" → wiki_task(annotate)
  └── Work completed → wiki_task(done)

Session end (optional)
  └── wiki_week() → refresh WEEK.md
```

## Drafting guidance

- Ground every draft in the read state. A draft that invents a project or
  tag Walker never uses is a failed draft.
- If Walker's description maps to an existing pending task, say so instead
  of drafting a duplicate.
- If the estimate would exceed 3 days, propose a split chain per
  creation-rules.md before drafting.

## Managing existing tasks (discuss a project or topic)

When Walker wants to adjust existing work:

```
1. Read state: task export project:<X>  (or by tag / scheduled range)
2. Discuss: what moves, what grows, what dies
3. Propose a change set — create / modify / done / delete, each with exact fields
4. Walker confirms — the whole set or item by item
5. Execute via wiki_task only:
   - modify → wiki_task(action: "modify", taskId, <fields>)
     validated; audit annotation auto-appended
   - delete → wiki_task(action: "delete", taskId, confirm: true)
     only after Walker's explicit per-task yes; audit-logged
6. Never run raw task modify / task delete yourself.
```

## Identity changes (rename / re-TYPE)

Description and TYPE are immutable. When scope truly changes:

```
1. wiki_task(done) the old task with a final annotation:
   "YYYY-MM-DD: Closed for scope change. Superseded by: <new topic>."
2. wiki_task(promote) the new task, carrying dependsOn from the old
   task's dependencies.
```
