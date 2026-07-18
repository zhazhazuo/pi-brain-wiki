# context-gather-agent

## Responsibility

Spawns an isolated Pi subagent inside a resolved external repository to produce a bounded context brief. Operates as the execution layer for `wiki_context_gather` — builds the agent task prompt, manages timeout and signal handling, and extracts the assistant's structured output.

## Entry Points

- `extensions/brain-wiki/src/context-gather-agent.ts` → `runRepoGatherAgent()` — main entry; spawns Pi CLI subprocess with gather task

## Key Files

- `extensions/brain-wiki/src/context-gather-agent.ts` → agent spawning, task prompt construction, timeout management
- `extensions/brain-wiki/src/context-gather.ts` → orchestrator that calls this agent after context resolution
- `extensions/brain-wiki/src/context-guards.ts` → pre-flight path guard before gather runs

## Constraints

- 180-second hard timeout (`AGENT_TIMEOUT_MS`)
- Skippable via `BRAIN_WIKI_SKIP_REPO_GATHER_AGENT=1` env var
- Agent reads `AGENTS.md` from target repo if present for local rules
- Never modifies files in the target repository — read-only inspection
- Outputs structured sections: Summary, Evidence, Limits, Suggested follow-ups

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | `extensions/brain-wiki/src/context-gather-agent.ts` | Agent prompt builder, Pi CLI subprocess spawner, signal/timeout handler |
| Consumer | `extensions/brain-wiki/src/context-gather.ts` | Calls `runRepoGatherAgent()` after resolving external context |
| Consumer | `extensions/brain-wiki/src/types.ts` | Defines `GatherRepoAgentInput`, `GatherRepoAgentResult` |
