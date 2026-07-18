# wiki-week

## Responsibility

Generates and writes the weekly task dashboard (`WEEK.md`). Renders Taskwarrior task data into a formatted markdown table with week number, date range, section headings, and per-status task groups. Provides the `wiki_week` tool for dashboard refresh.

## Entry Points

- `extensions/brain-wiki/src/wiki-week.ts` → `renderWeekMd()` — render task data into markdown dashboard
- `extensions/brain-wiki/src/wiki-week.ts` → `writeWeekMd()` — write rendered dashboard to `WEEK.md`

## Key Files

- `extensions/brain-wiki/src/wiki-week.ts` → dashboard renderer, file writer, data formatting
- `extensions/brain-wiki/src/wiki-week.test.ts` → unit tests for rendering and formatting

## Constraints

- Output path: `{vaultRoot}/WEEK.md`
- Header includes ISO week number and date range
- Refreshed timestamp rendered in italics
- Sections rendered as markdown tables with dynamic column keys
- Empty sections show "*No tasks*" placeholder
- Appends trailing newline to output

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/wiki-week.ts` | Dashboard renderer, markdown table builder, file writer |
| Consumer | `extensions/brain-wiki/index.ts` | Wires `wiki_week` tool handler |
