# External Context Rules

## Activation

Repo-backed context is **explicit**. Valid triggers:
- Walker asks for repo-backed context for a note or system
- Walker is setting up or verifying a context registry entry
- A loaded skill or workflow intentionally calls resolve → gather

Invalid trigger:
- A PKB note appears in conversation but Walker did not ask for repo context

When unsure, ask: "Do you want repo-backed context for this, or PKB/wiki-only reasoning?"

## Three-Layer Model

| Layer | Location | Contains |
|-------|----------|----------|
| Note pointer | PKB frontmatter `brain_wiki_context` | Stable context id only |
| Registry | `.wiki/config.json` → `contexts` | label, pkb_note, repo_key, intents, scope hints |
| Local paths | `.wiki/env.local.json` (untracked) | repo_key → absolute directory path |

Never put filesystem paths in PKB notes or checked-in wiki config.

## Tool Contract

1. `wiki_context_list()` — catalog configured contexts and access flow
2. `wiki_context_resolve({ context_id? , pkb_note? })` — at least one input
3. `wiki_context_gather({ context_id, intent, query?, limit_commits? })`

Resolve performs config validation only. Gather spawns an **isolated Pi agent** in the resolved repository cwd. That repo agent reads `AGENTS.md`, uses repository-local skills, and returns a structured brief.

**Parent wiki session rules:**
- Use the gather brief for wiki/PKB reasoning
- Do **not** call `read`, `grep`, `find`, `ls`, or `bash` against external repository paths directly — the extension blocks these and directs you back to `wiki_context_gather`

## Fail-Closed Errors

If resolve or gather fails, report the structured error and stop. Do not:
- Guess alternate paths
- Fall back to shell find/grep across the laptop
- Read unrelated repositories

Common fixes:
- Missing registry entry → run setup workflow (`instructions/setup.md`)
- Missing env mapping → add `repo_key` to `.wiki/env.local.json`
- Intent not allowed → update `allowed_intents` in registry (with Walker confirmation)
- Missing query → ask Walker for a concrete search string

## Write Boundaries

**May edit (with Walker confirmation):**
- `.wiki/config.json` → `contexts` entries
- `.wiki/env.local.json` → machine-local repo paths
- PKB note frontmatter → `brain_wiki_context` pointer

**Must not edit:**
- External repository source files
- PKB note body with raw repo paths or large code dumps

**When weaving gather results into wiki:**
- Summarize with evidence references
- Link to PKB note; do not mirror full source trees into wiki pages
