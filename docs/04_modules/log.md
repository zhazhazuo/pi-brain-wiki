# Module: log

## Responsibility

Appends structured events to meta/events.jsonl and regenerates meta/log.md from the event history. Supports marking sources as integrated.

## Entry Points

- extensions/brain-wiki/src/log.ts → appendEvent(), markSourcesIntegrated(), rebuildLog()

## Key Files

- extensions/brain-wiki/src/log.ts → all logging logic

## Constraints

- Events are append-only — never edited or deleted
- Events stored as JSONL (one JSON object per line)
- log.md is regenerated from scratch each time from the events.jsonl file
- Event kinds: capture, integrate, query, plan, review, lint, refactor, rebuild

## Lifecycle Events

| Kind | Effect |
|------|--------|
| `consumed` | Updates page frontmatter: `status: consumed`, `consumed_at: <timestamp>`, `pkb_refs: [...]`. Notes prefixed `pkb:` provide the PKB paths. |
| `archived` | Updates page frontmatter: `status: archived` |
| `cleared` | Updates page frontmatter: `status: cleared`, `cleared_at: <timestamp>` |

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/log.ts | appendEvent(): writes to events.jsonl; markSourcesIntegrated(): updates summary pages; rebuildLog(): regenerates log.md from event history |
| Consumer | extensions/brain-wiki/index.ts | tool handlers call appendEvent() after operations; rebuildLog() called during metadata rebuild |
