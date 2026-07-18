# context-guards

## Responsibility

Pre-flight guard that intercepts tool calls (read, grep, find, ls, bash) and detects when a target path falls within a configured external repository. Returns a guard result with the matching context ID, label, and repo path so the agent can route through `wiki_context_resolve` instead of direct file access.

## Entry Points

- `extensions/brain-wiki/src/context-guards.ts` → `checkExternalContextGuard()` — main guard check for a tool call

## Key Files

- `extensions/brain-wiki/src/context-guards.ts` → path extraction, repo containment check, guard result assembly
- `extensions/brain-wiki/src/config.ts` → loads external context config and env.local repo paths
- `extensions/brain-wiki/src/types.ts` → defines `ExternalContextGuardResult`

## Constraints

- Only guards tools in the protected set: read, grep, find, ls, bash
- Resolves absolute paths from relative inputs using `cwd`
- Extracts paths from bash commands via regex for `/Users/`, `/home/`, `/tmp/`, etc.
- Returns `null` (no guard) when no external context matches — caller proceeds normally
- Fail-closed: config or env errors do not throw, they skip the guard

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/context-guards.ts` | Path extraction from tool input, repo containment check |
| Consumer | `extensions/brain-wiki/index.ts` | Wires guard into `PreToolUse` hook for automatic interception |
| Consumer | `extensions/brain-wiki/src/config.ts` | Provides `loadConfig()` and `loadLocalEnvConfig()` for repo path resolution |
