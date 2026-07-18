# task-validator

## Responsibility

Validation engine for task promotion payloads. Enforces creation rules before any task reaches Taskwarrior — validates project format, description type prefix, word count limits, priority, estimate, scheduled date, and required tags.

## Entry Points

- `extensions/brain-wiki/src/task-validator.ts` → `validatePromotion()` — validate a promotion payload against all rules

## Key Files

- `extensions/brain-wiki/src/task-validator.ts` → validation logic, error code definitions
- `extensions/brain-wiki/src/task-validator.test.ts` → unit tests for all validation rules
- `extensions/brain-wiki/src/types.ts` → `PromotionPayload`, `TaskValidationResult`

## Constraints

- Project must use `Domain.SpecificOutcome` format (dot-separated)
- Description must start with a TYPE prefix: `BUG:`, `FEAT:`, `RD:`, `REVIEW:`, `SETUP:`, `PLAN:`, `MEETING:`
- Description body max 8 words
- URLs forbidden in description (use `task annotate` instead)
- Priority: `H`, `M`, or `L`
- Estimate: one of `0.5, 1, 1.5, 2, 2.5, 3`
- `scheduled` date is required
- At least one tag is required

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/task-validator.ts` | Promotion payload validation with structured error codes |
| Consumer | `extensions/brain-wiki/src/task-sync.ts` | Validates before promoting LIST.md items to Taskwarrior |
| Consumer | `extensions/brain-wiki/src/task-scan.ts` | Pre-validates proposed promotions |
