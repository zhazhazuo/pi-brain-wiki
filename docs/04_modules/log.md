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

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/log.ts | appendEvent(): writes to events.jsonl; markSourcesIntegrated(): updates summary pages; rebuildLog(): regenerates log.md from event history |
| Consumer | extensions/brain-wiki/index.ts | tool handlers call appendEvent() after operations; rebuildLog() called during metadata rebuild |
