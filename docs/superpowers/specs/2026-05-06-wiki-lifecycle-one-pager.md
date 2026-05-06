# Wiki Lifecycle System — Refined Design

## Problem Statement

How might we give wiki knowledge a clean lifecycle from first capture to PKB residency — so the wiki stays a staging area (not a graveyard), Walker always knows where the source of truth lives, and the system can reactivate, retire, or prune pages as knowledge evolves?

## Recommended Direction

A **status-driven lifecycle** with three additions to the existing system:

1. **New statuses** (`consumed`, `cleared`) added to the existing frontmatter-based state machine. No folder moves. No new directories. Path stability preserved throughout the lifecycle.

2. **Recall as a skill**, not a new agent. The comparison workflow (read wiki source → search PKB → produce gap/drift list → propose edits) is a skill prompt that any agent can follow. Intelligence tracks the backlogs. Workshop triggers reactivation. No new agent profile needed.

3. **Obsidian wikilinks for PKB references.** `pkb_ref` stores a vault-relative path (`Resource/1 CS/17 AI/LLM Memory.md`), resolvable by both Obsidian (click) and agents (filesystem search). If the file moves, fuzzy resolution finds it. If it's gone, Recall flags it.

4. **Reactivation: consumed topics wake up.** When a new source is integrated into a `consumed` topic, Workshop flips it back to `integrated` and logs the reactivation. `consumed` is a checkpoint ("reviewed against PKB at least once"), not a destination.

The full lifecycle:

```
captured → integrated → consumed → archived → cleared
               ↑            │
               └────────────┘  (reactivation on new source)
```

## Key Assumptions to Validate

- [ ] **Workshop follows the reactivation rule** — skill prompts must instruct Workshop to check topic status before integrating. Lint catches violations (consumed topic with newly-integrated sources still pointing at it).
- [ ] **Obsidian wikilinks resolve reliably** — `pkb_ref` stores the vault-relative path; agents resolve it via filesystem search. Test with real PARA paths that include spaces and special characters.
- [ ] **Search exclusion of archived/cleared doesn't lose important context** — validate that the `includeArchived` override is sufficient for the rare cases where Walker needs historical search.
- [ ] **Intelligence can track lifecycle backlogs from existing registry data** — straightforward scan of status fields + dates, but verify the output format is actionable.

## MVP Scope

### Tool changes (code)

| Tool | Change |
|------|--------|
| `wiki_search` | Exclude `archived` and `cleared` from results by default. Add `includeArchived` parameter. |
| `wiki_lint` | Skip `archived`/`cleared` entries in all checks. Validate `consumed_at` + `pkb_ref` on `consumed` entries. Add staleness check: `consumed` topics with newly-integrated sources are flagged. |
| `wiki_log_event` | Accept new event kinds: `consumed`, `archived`, `cleared`. `consumed` events update frontmatter (`consumed_at`, `pkb_ref`). |
| `wiki_scan_activity` | Add lifecycle backlog fields: `integrated_count`, `consumed_count`, `archived_count`, `oldest_integrated`, `clearable_candidates`. |
| `wiki_status` | Add consumed/archived/cleared counts to the dashboard output. |

### Type changes (code)

| Type | Change |
|------|--------|
| `SourceManifest.status` | Add `"consumed"` and `"cleared"` to the union |
| `WikiEventKind` | Add `"consumed"`, `"archived"`, `"cleared"` |
| `RegistryEntry` | Add optional `consumed_at` and `pkb_ref` fields |
| Frontmatter conventions | Summary/topic pages gain `consumed_at` and `pkb_ref` when status = consumed |

### New skill

| Skill | Purpose |
|-------|---------|
| `recall` | Guides the comparison workflow: read wiki source → search PKB → produce gap/drift list → propose PKB edits → mark consumed. Any agent can use this. |

### Intelligence skill update

Add a **Lifecycle Backlog** section to the Intelligence output:

- **Awaiting Recall review** (integrated → consumed): summaries/topics in `integrated` status for 2+ weeks
- **Awaiting clearing** (archived → cleared): entries with no active links, PKB-covered entries, superseded entries
- **Stale consumed** (consumed but reactivated): consumed topics with new sources pointing at them

## Not Doing (and Why)

- **Dedicated Recall agent.** The comparison workflow is a prompt, not a persistent agent. Intelligence owns the backlog. Any agent with the Recall skill can execute it. Adding an agent profile, session flow, and boundaries is complexity without benefit.
- **`pkb_path` as a hardcoded reference.** Paths in PARA aren't stable. Using a vault-relative path with fuzzy resolution is more resilient. The Obsidian ecosystem (wikilinks, search) handles renames.
- **`reactivated` as a distinct status.** Reactivation just flips `consumed` → `integrated`. The event log records the reactivation. The status reflects the current state, not the history.
- **Moving files between directories for lifecycle transitions.** All transitions are frontmatter changes. This preserves wikilink integrity and path stability.
- **Automatic Recall session triggering.** Intelligence surfaces the backlog; Walker decides when to run Recall. Auto-triggering creates noise and risks unsupervised PKB edits.
- **Deleting cleared entries immediately.** `cleared` status with a 30-day grace period. Intelligence flags candidates for permanent deletion. Walker confirms.

## Open Questions

- Should `pkb_ref` be a single reference or an array? (One summary might inform several PKB entries.)
- What's the UX for Walker confirming "consumed"? A command (`/wiki-consumed`)? A Recall skill prompt that ends with "mark consumed"? Or just `wiki_log_event` with kind=consumed?
- Should the Recall skill have a linter-verified rule ("you MUST mark consumed after comparison") or is it advisory?