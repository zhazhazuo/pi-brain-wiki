# Module: guards

## Responsibility

Analyzes tool mutations (write/edit) to detect attempts to modify protected wiki paths. Blocks writes to inbox/ and meta/ directories and tracks changes to wiki pages for auto-rebuild.

## Entry Points

- extensions/brain-wiki/src/guards.ts → analyzeToolMutation()

## Key Files

- extensions/brain-wiki/src/guards.ts → all guard logic

## Constraints

- Protected paths are defined in config.protect (defaults: inbox/**, meta/registry.json, meta/backlinks.json, meta/events.jsonl, meta/index.md, meta/log.md, meta/lint-report.md)
- Analysis compares the target file path against protected glob patterns
- Wiki page mutations are tracked to trigger metadata rebuild on agent end

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/guards.ts | analyzeToolMutation(): parses tool input, resolves file paths, checks against protected patterns, classifies as wiki path or protected path |
| Consumer | extensions/brain-wiki/index.ts | tool_call event hook calls analyzeToolMutation() before allowing writes |
