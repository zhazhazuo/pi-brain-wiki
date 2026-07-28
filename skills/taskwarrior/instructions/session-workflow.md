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
