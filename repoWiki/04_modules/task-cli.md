# task-cli

## Responsibility

Taskwarrior CLI execution wrapper. Provides a typed interface for running `task` commands, exporting task records as JSON, and parsing Taskwarrior-specific error messages into actionable diagnostics.

## Entry Points

- `extensions/brain-wiki/src/task-cli.ts` → `taskExec()` — execute arbitrary task command with dry-run support
- `extensions/brain-wiki/src/task-cli.ts` → `taskExport()` — export tasks matching a filter as JSON records

## Key Files

- `extensions/brain-wiki/src/task-cli.ts` → command runner, export parser, error diagnostics
- `extensions/brain-wiki/src/task-cli.test.ts` → unit tests for CLI wrapper and error parsing
- `extensions/brain-wiki/src/capture.ts` → defines `CommandRunner` interface used here

## Constraints

- Uses `CommandRunner` abstraction for testability
- Dry-run mode returns success without executing
- Exit code 127 = Taskwarrior not installed
- Detects UDA configuration errors and provides specific remediation
- Export uses `rc.json.array=on` for consistent JSON output
- Returns `TaskCliResult` with `success`, `stdout`, `stderr`, `exitCode`, `errors`

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/task-cli.ts` | Command execution, export parsing, error diagnostics |
| Consumer | `extensions/brain-wiki/src/task-sync.ts` | Uses `taskExec()` and `taskExport()` for bidirectional sync |
| Consumer | `extensions/brain-wiki/src/task-scan.ts` | Uses `taskExport()` for scanning existing tasks |
