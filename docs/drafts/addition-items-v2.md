# Wiki Position — Addition Items v2

> **Companion to:** `2026-05-08-wiki-position-and-role.md` + `addition-items-v1.md` + `issue-v2.md`
> **Date:** 2026-05-09
> **Status:** Draft — advice on unresolved issues

---

## Issue 1: Wiki→PARA Contradiction

**Advice:** Refine the principle, don't remove the arrow.

The principle should be: **The agent never autonomously writes to PARA. But the human can instantiate PARA content informed by Wiki.**

```
Wiki/ (drafting space)
    ↓  "agent proposes, human decides"
Project/ (active work)
```

The arrow is **dotted** (human-initiated), not **solid** (automatic). The agent says "this plan is ready, want me to create a Project/ folder?" The human says yes or no. The agent executes, but the human authorizes.

Same for knowledge: Wiki topic is enriched → agent suggests "this is ready for Area/" → human decides → agent (or human) writes to Area/.

**Update the diagram:** Change solid arrows to dotted arrows with "human decides" annotation.

---

## Issue 2: No Wiki Digest

**Advice:** This is the highest leverage item. Build it from existing components.

**What exists today:**
- `registry.json` — all pages indexed
- `events.jsonl` — event log
- `meta/log.md` — human-readable events
- `wiki_lint` — stale/orphan detection
- `wiki_scan_activity` — activity scanning

**What's needed:**
- A function `buildDigest(root)` that reads all of the above and outputs `meta/wiki-digest.md`
- Trigger: same as `rebuildAllGeneratedArtifacts()` in `agent_end` hook
- No new tools needed — just a new output file from the existing rebuild pipeline

**MVP content:**
```markdown
# Wiki Digest

## Stats
- Topics: 24 | Summaries: 18 | Plans: 3 | Reviews: 2
- Sources: 18 captured, 12 integrated, 4 consumed

## Active Discussions
(none until #3 is built)

## Recent Events (last 7d)
- 2026-05-08 Captured SRC-2026-05-08-001

## Needs Attention
- lambda-calculus: 2 sentences (below minimum)
- functional-programming: no activity in 14d

## Stale
- old-source-1: integrated 21d, not consumed
```

This alone unblocks the "Wiki first" posture.

---

## Issue 3: No Discussion System

**Advice:** Start minimal. Don't overbuild.

**MVP:** Just files. No new tools yet.

```
Wiki/discussions/
├── route.md              ← simple markdown list, not YAML
└── 2026-05-08-widget.md  ← briefing file
```

**route.md format (MVP):**
```markdown
# Discussions

## Active
- [2026-05-08 Widget Launch](2026-05-08-widget.md) — planning

## Recent
- [2026-05-07 Type Systems](2026-05-07-type-systems.md) — source consumption ✓

## Archive
- [2026-05-01 FP Review](2026-05-01-fp-review.md) — internalized
```

**Agent behavior (MVP):**
1. At session start, read `route.md`
2. If continuing an active discussion, read the briefing file
3. After discussion, update briefing file with results
4. Update route.md status manually (edit tool)

**No new tools for MVP.** Just files + skill instructions. Tools come later when the pattern is proven.

---

## Issue 4: Route File Scalability

**Advice:** Don't solve this now. It's a future problem.

When it becomes a problem (100+ discussions), the fix is simple:
- `route.md` only shows **active** discussions (5-10 max)
- Completed/archived discussions move to `route-archive-YYYY-MM.md`
- Agent reads active route only; archive is for historical reference

But this is a Year 2 problem. Build the MVP first.

---

## Issue 5: Staleness / Sync Detection

**Advice:** Add `last_synced` to topic frontmatter. Add a lint rule.

**Topic frontmatter addition:**
```yaml
---
type: topic
title: Computer Science
status: integrated
last_synced: 2026-05-08      ← new
para_source: Resource/1 CS/  ← new
---
```

**Lint rule:**
- Compare `last_synced` on topic page to mtime of PARA folder
- If PARA folder modified after `last_synced`, flag as stale
- Output: "topics/computer-science.md may be stale — Resource/1 CS/ modified 2026-05-09"

**Trigger:** Part of existing `wiki_lint` staleness mode. No new tool needed.

**Also:** `wiki_sync` should update `last_synced` when it runs. This makes sync detectable.

---

## Issue 6: Lifecycle Auto-Triggers

**Advice:** Define grace periods. Hook into lint, not auto-actions.

| Transition | Trigger | Grace Period |
|------------|---------|-------------|
| `integrated` → suggest consumption | Age-based | 14 days since integration |
| `consumed` → suggest archival | Age-based | 30 days since consumed |
| `archived` → suggest clearing | Age-based | 60 days since archived |
| `draft` → flag stale | Activity-based | 30 days since last edit |

**Key:** The agent **suggests**, never auto-transitions. Lint flags it. The agent presents it to the user. The user decides.

This keeps the "human decides PARA, agent decides Wiki" principle. Lifecycle suggestions go through the agent to the user.

---

## Issue 7: Draft/ Folder Position

**Advice:** This is a design decision that's already been made. Just needs implementation.

**Changes:**
1. Create `Wiki/drafts/` directory in scaffold
2. Remove `Draft/` from `allowExternal` in config
3. Update `scanActivity` to scan `Wiki/drafts/` instead of `Draft/`
4. Update `wiki_sync` to not scan `Draft/`
5. Migrate any existing `Draft/` content to `Wiki/drafts/`

This is a clean cut. No ambiguity.

---

## Issue 8: Obsidian Link Resolution

**Advice:** Add a utility function in Layer 0.

```typescript
// layer0/vault.ts
export function resolveWikiLink(wikiRoot: string, link: string): string | null {
  // [[Area/1 CS/Type Theory]] → /path/to/vault/Area/1 CS/Type Theory.md
  // [[topics/functional-programming]] → /path/to/wiki/pages/topics/functional-programming.md
  // [[summaries/2026-05-07-source]] → /path/to/wiki/pages/summaries/2026-05-07-source.md
  
  const clean = link.replace(/^\[\[|\]\]$/g, "");
  
  if (clean.startsWith("Area/") || clean.startsWith("Project/") || 
      clean.startsWith("Resource/") || clean.startsWith("Archive/")) {
    return join(vaultRoot(wikiRoot), clean + ".md");
  }
  
  if (clean.startsWith("topics/") || clean.startsWith("summaries/") || 
      clean.startsWith("plans/") || clean.startsWith("reviews/")) {
    return join(wikiRoot, "pages", clean + ".md");
  }
  
  return null;
}
```

This goes in Layer 0. Layer 1 domain logic uses it. Layer 2 tools expose it if needed.

---

## Issue 9: Session Start Sequence

**Advice:** Blocked on #2 and #3. Once those exist, update the skills.

**Session start sequence (when #2 and #3 are done):**

```
1. Read Wiki/discussions/route.md    → active discussions
2. Read Wiki/meta/wiki-digest.md     → Wiki state
3. Read LIST.md                      → human queue
4. Respond to user
```

**Implementation:** Update `brain-wiki` SKILL.md startup checklist. No code change needed — it's a skill instruction, not a tool.

**But:** The agent might skip steps if the skill isn't loaded. Consider a Layer 2 hook that reads these files automatically and injects context into the agent session. That's a future enhancement.

---

## Issue 10: Drafts vs Plans Boundary

**Advice:** Simple rule:

| Folder | Content | When |
|--------|---------|------|
| `Wiki/drafts/` | Ideas, WIP, half-formed thoughts | Any time, agent or user |
| `Wiki/pages/plans/` | Ready-to-execute plans | When user commits to action |

**Promotion path:**
```
Wiki/drafts/idea.md → agent + user iterate → user says "let's do this" → Wiki/pages/plans/YYYY-MM-DD-plan.md
```

The draft stays in `drafts/` as history. The plan is the committed version. No automatic promotion — user decides.

---

## Issue 11: wiki_sync Bootstrap Semantics

**Advice:** Change the tool description and add a `last_synced` field.

**Current description:** "Run with scope='all' after adding new PARA folders"

**New description:** "Seed Wiki topic pages from PARA structure. Run once during setup, then again only when new PARA folders are added. Agent builds Wiki organically after initial sync."

**Add to config or meta:**
```json
{
  "last_full_sync": "2026-05-08T10:00:00Z"
}
```

**Lint rule:** If `last_full_sync` is older than 30 days and PARA has new folders, suggest re-running `wiki_sync`.

---

## Summary of Advice

| # | Issue | Advice |
|---|-------|--------|
| 1 | Wiki→PARA contradiction | Refine principle: agent proposes, human decides. Dotted arrows. |
| 2 | No wiki digest | **Build first.** MVP from existing components. Highest leverage. |
| 3 | No discussion system | **MVP: files only.** route.md + briefing files. No new tools yet. |
| 4 | Route scalability | Don't solve now. Year 2 problem. |
| 5 | Staleness detection | Add `last_synced` to frontmatter + lint rule. |
| 6 | Lifecycle auto-triggers | Define grace periods. Lint suggests, agent presents, human decides. |
| 7 | Draft/ position | Already decided. Just implement. |
| 8 | Link resolution | Add `resolveWikiLink()` to Layer 0. |
| 9 | Session start | Blocked on #2, #3. Then update skills. |
| 10 | Drafts vs plans | Simple rule: drafts = WIP, plans = committed. User promotes. |
| 11 | wiki_sync bootstrap | Change description. Add `last_full_sync`. Lint rule. |

---

## Recommended Priority Order

| Priority | Issue | Why |
|----------|-------|-----|
| 1 | #2 Wiki digest | Biggest lever. Builds from existing code. Unblocks "Wiki first" posture. |
| 2 | #3 Discussion system MVP | Files only, no new tools. Enables session continuity. |
| 3 | #5 Staleness detection | Small change, big impact. Makes Wiki trustworthy. |
| 4 | #7 Draft/ position | Already decided. Clean cut. Simplifies zone map. |
| 5 | #8 Link resolution | Small utility. Enables agent to read PARA via Wiki links. |
| 6 | #1, #6, #9, #10, #11 | Follow naturally after above. |
| 7 | #4 Route scalability | Year 2 problem. Don't solve now. |
