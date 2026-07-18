# workflow-gate

## Responsibility

Routes user requests through learned workflow pages. Checks the registry for workflow pages whose triggers or aliases match the user's intent, and returns the matching workflow page path for the agent to follow.

## Entry Points

- `extensions/brain-wiki/src/workflow-gate.ts` → `matchWorkflow()` — find workflow page matching user intent text

## Key Files

- `extensions/brain-wiki/src/workflow-gate.ts` → trigger matching, normalized lookup
- `extensions/brain-wiki/src/workflow.ts` → creates the workflow pages this module searches

## Constraints

- Matching is case-insensitive via `normalizeLookup()`
- Checks both `title` and `aliases` (triggers) against normalized query
- Returns first match only — no ranking or priority
- Returns `null` when no workflow matches — caller falls through to default behavior
- Only matches pages with `type: "workflow"` in registry

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/workflow-gate.ts` | Trigger/alias matching against registry |
| Consumer | `extensions/brain-wiki/index.ts` | Wires into agent request routing for workflow invocation |
| Consumer | `extensions/brain-wiki/src/workflow.ts` | Creates workflow pages with triggers this module matches |
