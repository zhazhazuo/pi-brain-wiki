# Module: lifecycle

## Responsibility

Hardcoded grace period constants for wiki page lifecycle transitions. Centralizes timing thresholds so lint and activity modules stay consistent.

## Entry Points

- `extensions/brain-wiki/src/lifecycle.ts` → `GRACE_PERIODS`

## Key Files

- `extensions/brain-wiki/src/lifecycle.ts` → constants only

## Constraints

- Hardcoded for MVP — not configurable via `.wiki/config.json`
- All lifecycle suggestions are lint flags, not auto-transitions

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/lifecycle.ts` | Exports `GRACE_PERIODS`: integrated→consumed (14d), consumed→archived (30d), archived→cleared (60d), draft stale (30d) |
| Consumer | `extensions/brain-wiki/src/lint.ts` | `lintStaleness()` uses `GRACE_PERIODS.draft_stale` |
| Consumer | `extensions/brain-wiki/src/activity.ts` | `computeLifecycleBacklog()` uses `GRACE_PERIODS.integrated_to_consumed` |
