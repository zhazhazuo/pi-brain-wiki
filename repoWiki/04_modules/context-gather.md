# Module: context-gather

## Responsibility

Runs intent-specific bounded read-only recipes against a resolved external repository and returns structured evidence.

## Entry Points

- extensions/brain-wiki/src/context-gather.ts → `gatherExternalContext()`

## Key Files

- extensions/brain-wiki/src/context-gather.ts → per-intent recipes, evidence assembly, limits reporting

## Constraints

- Requested intent must be listed in the context's `allowed_intents`
- `implementation` and `question` require a non-empty `query`
- Read-only — gathers from resolved repo cwd with include/exclude path filters
- Bounded defaults: 3 seed files, 5 search results, 5 commits
- Uses injected `readTextFile` and `execCommand` helpers (wired to `pi.exec` with `rg`/`git` in index.ts)
- Returns `files_read`, `commands_used`, `summary`, `evidence`, `limits_hit`, `follow_up_suggestions`

## Gather Intents

| Intent | Recipe summary |
|--------|----------------|
| `overview` | Read seed files, list repo paths |
| `architecture` | Seed files + repo listing + architecture search |
| `implementation` | Requires `query`; search repo for matches |
| `recent_changes` | Bounded `git log` window |
| `question` | Requires `query`; maps to bounded search/read recipe |
| `handoff` | Seed files only; compact continuation brief |

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/context-gather.ts | Intent routing, seed file reads, repo list/search, commit inspection, evidence types |
| Consumer | extensions/brain-wiki/index.ts | `wiki_context_gather` tool handler and `pi.exec` wiring |
| Consumer | extensions/brain-wiki/src/context-resolve.ts | supplies `ResolvedExternalContext` input |
