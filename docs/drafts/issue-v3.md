# Unresolved Issues — v3

> **Companion to:** `2026-05-09-wiki-position-and-role-v2.md`
> **Date:** 2026-05-09
> **Status:** Open — decisions needed before implementation

---

## Issue 12: Draft/ Migration Strategy

**Background:** The v2 design moves `Draft/` from external PARA into `Wiki/drafts/`. But existing vaults already have `Draft/` at vault root. This is a user-facing breaking change.

**Current code still references external Draft/:**
- `config.ts`: `allowExternal: ["../Draft/**", ...]`
- `paths.ts`: `draftRoot()` returns `vaultRoot/Draft/`
- `activity.ts`: `scanActivity()` scans external `Draft/`

**Options:**

| Option | How | Pros | Cons |
|--------|-----|------|------|
| **A. Clean cut** | Remove `../Draft/**` from `allowExternal`, update all code, provide migration guide | Simple, no technical debt | Breaks existing vaults; Obsidian links to `[[Draft/Foo]]` break |
| **B. Phased deprecation** | Step 1: Create `Wiki/drafts/`, stop scanning external Draft/ in new code; Step 2: Add lint warning if external Draft/ exists; Step 3: Eventually remove support | Graceful for users | More complex, longer tail |
| **C. Configurable** | Add `draftsLocation` to config: `"wiki"` (new) or `"external"` (legacy) | Backward compatible | Adds complexity, may never remove legacy path |

**Recommendation:** Option B (phased). Start by adding `Wiki/drafts/` to scaffold and making it the default for new vaults. Keep external Draft/ support temporarily with a deprecation warning in lint.

---

## Issue 13: Bootstrap Missing New Folders

**Background:** The v2 design adds `Wiki/discussions/` and `Wiki/drafts/` to the vault structure. But `bootstrapVault()` in `scaffold.ts` does not create them.

**Current `bootstrapVault` creates:**
```typescript
const created = [
  join(root, "inbox"),
  join(root, "pages", "summaries"),
  join(root, "pages", "topics"),
  join(root, "pages", "plans"),
  join(root, "pages", "reviews"),
  join(root, "meta"),
  join(root, "archive"),
  join(root, ".wiki", "templates"),
];
```

**Missing:**
- `join(root, "discussions")` — for discussion records
- `join(root, "drafts")` — for mutable work-in-progress

**Fix:** Trivial — add both folders to the `created` array.

---

## Issue 14: Digest Rebuild Frequency

**Background:** The v2 design says the Wiki digest is "regenerated after every agent turn." But the actual `agent_end` hook in `index.ts` runs `rebuildAllGeneratedArtifacts()` once per session, not per turn.

**Question:** What is the correct trigger for digest rebuild?

| Option | Trigger | Pros | Cons |
|--------|---------|------|------|
| **A. Every turn** | Add to `tool_call` hook or similar | Always current | Expensive for large vaults (20 turns = 20 rebuilds) |
| **B. Session end** | Keep in `agent_end` hook | Efficient | Digest may be stale during long sessions |
| **C. On change only** | Rebuild only when registry/events actually change | Most efficient | Requires change-detection logic |
| **D. Explicit only** | No auto-rebuild; agent calls `wiki_rebuild_meta` manually | Predictable cost | Agent must remember to rebuild |

**Recommendation:** Option C (on change only). Track a dirty flag when events are appended or page statuses change. Rebuild digest only when the dirty flag is set. This is what `dirtyRoots` already does for registry rebuild — extend the same pattern.

---

## Issue 15: Grace Period Configurability

**Background:** The v2 design specifies grace periods for lifecycle transitions:

| Transition | Grace Period |
|------------|-------------|
| `integrated` → suggest consumption | 14 days |
| `consumed` → suggest archival | 30 days |
| `archived` → suggest clearing | 60 days |
| `draft` → flag stale | 30 days |

**Question:** Should these be hardcoded constants or configurable in `.wiki/config.json`?

| Option | Pros | Cons |
|--------|------|------|
| **Hardcoded** | Simple, consistent across vaults | Inflexible for different workflows |
| **Configurable** | Adapts to user preference | More config surface, needs validation |

**If configurable:**
- What are the config keys? `gracePeriods.integrated`, `gracePeriods.consumed`, etc.?
- What validation rules? Min/max bounds? Must be positive integers?
- What are the defaults? The v2 values (14/30/60/30)?

**Recommendation:** Hardcoded for MVP. Add to config only if users request it. The values are reasonable defaults and fewer knobs means fewer bugs.

---

## Issue 16: "Below Minimum" Heuristic Undefined

**Background:** The v2 digest example shows:
```markdown
## Needs Attention
- lambda-calculus: 2 sentences (below minimum)
```

But nowhere is "minimum" defined. What makes a topic page "below minimum"?

**Candidate heuristics:**

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Word count | < 100 words | A useful topic needs substance |
| Heading count | < 2 headings | Needs some structure |
| Source count | 0 `source_ids` | Orphaned topic with no backing sources |
| Link count | 0 outbound links | Disconnected from the rest of the wiki |
| Combined | Any 2 of the above | More robust than single metric |

**Question:** Which heuristic? Single metric or combined? What are the exact thresholds?

**Recommendation:** Combined heuristic for MVP: flag if word count < 100 AND source count < 2. This catches both thin content and orphaned topics. Thresholds can be adjusted based on usage.

---

## Issue 17: Discussion Route File Format — Machine vs Human

**Background:** The v2 design uses markdown with YAML frontmatter for `route.md`:

```markdown
---
active:
  - date: 2026-05-08
    topic: Widget Launch
    briefing: 2026-05-08-widget.md
---

# Discussions
## Active
- [2026-05-08 Widget Launch](2026-05-08-widget.md) — planning
```

**Question:** Is this the right format? Tradeoffs:

| Aspect | YAML frontmatter | Pure markdown list |
|--------|------------------|-------------------|
| Machine parsing | Reliable (gray-matter) | Fragile (regex) |
| Human readability | Good | Good |
| Agent editing | Easy (edit frontmatter) | Harder (edit specific line) |
| Obsidian rendering | Frontmatter hidden | Fully visible |

**Concern:** The agent needs to both read (parse) and write (edit) this file. Frontmatter is easy to parse but editing a specific discussion's state requires precise text replacement.

**Alternative:** Use a simple JSON or YAML file that the agent reads/writes as structured data, with a separate human-readable markdown file generated from it (same pattern as `events.jsonl` → `log.md`).

**Recommendation:** Stick with frontmatter + markdown body for MVP. The agent can use the existing `parsePage`/`writePage` utilities (gray-matter). If editing proves fragile, switch to JSON + generated markdown in v2.

---

## Summary Table

| # | Issue | Type | Urgency | Recommendation |
|---|-------|------|---------|----------------|
| 12 | Draft/ migration | Decision | **High** | Phased deprecation (Option B) |
| 13 | Bootstrap folders | Code fix | **High** | Add `discussions/` and `drafts/` to scaffold |
| 14 | Digest frequency | Decision | **Medium** | On-change only (Option C) |
| 15 | Grace periods | Decision | Low | Hardcoded for MVP |
| 16 | Below minimum heuristic | Decision | **Medium** | Combined: words < 100 AND sources < 2 |
| 17 | Route file format | Decision | Low | Frontmatter + markdown for MVP |

---

## Dependency Graph

```
#13 Bootstrap folders
    │
    ▼
#12 Draft/ migration ──► #14 Digest frequency ──► #15 Grace periods
    │                       │
    ▼                       ▼
#17 Route format        #16 Below minimum
```

**Parallel work possible:**
- #13 (bootstrap) and #12 (Draft/ migration) are independent
- #14 (digest), #15 (grace periods), #16 (heuristic) are independent once digest exists
- #17 (route format) is independent

**Critical path:** #13 → #12 → #14 → Implementation can begin
