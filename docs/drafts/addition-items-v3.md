# Wiki Position — Addition Items v3

> **Companion to:** `issue-v3.md`
> **Date:** 2026-05-09
> **Status:** Draft — advice on implementation-level decisions

---

## Issue 12: Draft/ Migration Strategy

**Advice:** Phased deprecation, three phases, no configurable option.

| Phase | When | What |
|-------|------|------|
| **Phase 1** | Now | Create `Wiki/drafts/` in scaffold. Update code to use it. Keep external `Draft/` in `allowExternal` with no warning. |
| **Phase 2** | Next release | Lint warning: "External `Draft/` detected. Consider moving to `Wiki/drafts/`." |
| **Phase 3** | Release after that | Remove external `Draft/` from `allowExternal`. Document migration. |

**Don't do Option C (configurable).** That's permanent complexity for a temporary problem. Two releases is enough runway.

**Obsidian links:** Existing `[[Draft/Foo]]` links won't break in Phase 1 or 2 — the file still exists. In Phase 3, the user has had time to move files and update links. Obsidian's rename/move handles link updates automatically.

---

## Issue 13: Bootstrap Missing New Folders

**Advice:** Trivial fix. Add both folders to scaffold.

```typescript
const created = [
  join(root, "inbox"),
  join(root, "drafts"),              // ← new
  join(root, "discussions"),         // ← new
  join(root, "pages", "summaries"),
  join(root, "pages", "topics"),
  join(root, "pages", "plans"),
  join(root, "pages", "reviews"),
  join(root, "meta"),
  join(root, "archive"),
  join(root, ".wiki", "templates"),
];
```

Also create `discussions/route.md` with empty structure during bootstrap:

```markdown
# Discussions

## Active

## Recent

## Archive
```

This gives the agent something to read at session start even if no discussions exist yet.

---

## Issue 14: Digest Rebuild Frequency

**Advice:** On-change only (Option C). Extend the existing `dirtyRoots` pattern.

Current code in `index.ts` already tracks dirty state:
```typescript
const dirtyRoots = new Set<string>();

pi.on("tool_call", async (event, ctx) => {
  dirtyRoots.add(root);  // mark dirty on any write
});

pi.on("agent_end", async (_event, ctx) => {
  for (const root of [...dirtyRoots]) {
    await rebuildAllGeneratedArtifacts(root);
    dirtyRoots.delete(root);
  }
});
```

**Extend:** Add `buildDigest(root)` to `rebuildAllGeneratedArtifacts()`.

```typescript
async function rebuildAllGeneratedArtifacts(root: string): Promise<string[]> {
  const config = await loadConfig(root);
  const { rebuilt } = await rebuildRegistryAndIndex(root);
  const logPath = await rebuildLog(root, config.title);
  const digestPath = await rebuildDigest(root);  // ← new
  return [...rebuilt, logPath, digestPath];
}
```

The digest rebuild is cheap — reads existing data (registry, events, lint), writes a markdown file. Same cost as `rebuildLog()`.

---

## Issue 15: Grace Period Configurability

**Advice:** Hardcoded for MVP. No config.

```typescript
// layer1/lifecycle.ts
export const GRACE_PERIODS = {
  integrated_to_consumed: 14,  // days
  consumed_to_archived: 30,
  archived_to_cleared: 60,
  draft_stale: 30,
} as const;
```

If users request configurability later, it's a one-line change per constant to read from config. But start simple. Fewer knobs, fewer bugs.

---

## Issue 16: "Below Minimum" Heuristic

**Advice:** Single metric for MVP. Word count < 100.

```typescript
export function isBelowMinimum(page: RegistryEntry): boolean {
  return (page.wordCount ?? 0) < 100;
}
```

**Why single metric:**
- Easy to implement
- Easy to understand
- Easy to tune
- Easy to explain: "This topic has only 47 words. It needs more substance."

**Why word count, not combined:**
- Combined heuristics are harder to debug
- "Words < 100 AND sources < 2" means a topic with 50 words and 3 sources passes — but 50 words is still thin
- Word count alone catches the real problem: thin content

**Implementation:** Add `wordCount` to `registry.json` during rebuild. The indexer already parses page content — counting words is trivial.

**Later (not MVP):** Add a second heuristic for orphaned topics (0 outbound links). But separate from "below minimum" — it's a different problem.

---

## Issue 17: Discussion Route File Format

**Advice:** Frontmatter + markdown for MVP. Same as every other Wiki page.

```markdown
---
type: discussion-route
updated: 2026-05-09
---

# Discussions

## Active
- [2026-05-08 Widget Launch](2026-05-08-widget.md) — planning
- [2026-05-09 API Review](2026-05-09-api-review.md) — source consumption

## Recent
- [2026-05-07 Type Systems](2026-05-07-type-systems.md) — finish ✓

## Archive
- [2026-05-01 FP Review](2026-05-01-fp-review.md) — internalized
```

**Why this works:**
- Agent parses with gray-matter (already in codebase)
- Agent edits specific lines with the `edit` tool (already works)
- Human reads in Obsidian (renders normally)
- No new parsing logic needed

**If editing proves fragile** (agent can't reliably find/edit specific lines), switch to JSON + generated markdown later. But try the simple approach first.

---

## Summary

| # | Issue | Advice |
|---|-------|--------|
| 12 | Draft/ migration | Phased deprecation, 3 phases, no configurable option |
| 13 | Bootstrap folders | Add `discussions/` and `drafts/` to scaffold, create empty `route.md` |
| 14 | Digest frequency | On-change only, extend existing `dirtyRoots` pattern |
| 15 | Grace periods | Hardcoded constants for MVP |
| 16 | Below minimum | Single metric: word count < 100 |
| 17 | Route file format | Frontmatter + markdown, same as other Wiki pages |

**Critical path:** #13 → #12 → #14 → implementation can begin.

All six issues are small decisions. None block implementation.
