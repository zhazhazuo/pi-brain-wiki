# integration

## Responsibility

Finalizes a captured source after graph discovery by marking the source packet, summary page, and selected topic pages as integrated. Transitions source state from `integration_pending` to `integrated` and records the integration event in the log.

## Entry Points

- `extensions/brain-wiki/src/integration.ts` → `integrateSource()` — main integration entry; updates source packet, pages, and logs

## Key Files

- `extensions/brain-wiki/src/integration.ts` → source state transition, page frontmatter update, event logging
- `extensions/brain-wiki/src/capture.ts` → upstream: creates source packets with `integration_pending` state
- `extensions/brain-wiki/src/log.ts` → downstream: records integration events

## Constraints

- Source must exist and be in `integration_pending` state
- At least one target page path required
- Updates `integrated` field on source packet frontmatter
- Appends `integrated: true` to each target page's frontmatter
- Logs event with `kind: integrate` and source ID

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/integration.ts` | State transition, frontmatter updates, event logging |
| Consumer | `extensions/brain-wiki/index.ts` | Wires `wiki_integrate_source` tool handler |
| Consumer | `extensions/brain-wiki/src/capture.ts` | Produces source packets this module consumes |
