# Recall Agent — Design Spec

> Status: draft
> Created: 2026-05-06
> Author: Walker + agent

---

## Problem

The wiki accumulates sources indefinitely. Once Walker internalizes knowledge and writes it into the PKB (Resource/, Project/, Area/, Draft/), the wiki entries become dead weight. There is no mechanism to:

1. Compare wiki content against PKB content for accuracy and completeness
2. Move wiki entries through a consumed → archived → cleared lifecycle
3. Clear outdated archived entries based on PKB coverage, source supersession, or manual review

## What the Recall Agent Does

The Recall Agent is the quality gate between the wiki (staging area) and the PKB (permanent knowledge). It has two phases:

### Phase 1: Review

Walker has internalized knowledge from wiki sources. Recall verifies the PKB entry is accurate and complete.

**Workflow:**

```
1. Walker points to a PKB entry (or wiki summary/topic)
2. Recall reads both:
   - Wiki summary/topic (source truth)
   - PKB entry (Walker's understanding)
3. Recall surfaces:
   - Gaps: source says X, PKB doesn't mention it
   - Drift: PKB says A, source says B
   - Enhancements: source has nuance that enriches PKB
4. Recall proposes specific edits to PKB (using write/edit tools), Walker reviews and confirms before applying
5. Walker confirms: "this is in my head now"
6. Recall marks summary/topic status → consumed
```

### Phase 2: Clearing

Archived entries that are no longer needed get removed.

**Triggers (all three combined):**

| Trigger | How it works |
|---------|-------------|
| Manual review | Recall presents archived entries, Walker selects which to clear |
| Source superseded | Newer source on same topic → older entry flagged as clearable |
| PKB coverage | Knowledge fully present in Resource/ → entry redundant, safe to clear |

**Workflow:**

```
1. Recall scans archived entries
2. For each, evaluates:
   - Is there a newer source on the same topic? → superseded
   - Is the knowledge fully in the PKB? → PKB covered
   - Neither? → manual review candidate
3. Presents candidates to Walker with evidence:
   - "This summary is superseded by [[summaries/newer-source]]"
   - "Resource/1 CS/17 AI/LLM Memory.md covers all claims from this summary"
   - "No clear signal — do you still need this record?"
4. Walker confirms which to clear
5. Recall removes cleared entries
```

## Agent Profile

| Property | Value |
|----------|-------|
| Name | Recall |
| Role | Quality gate: wiki → PKB |
| Reads | Wiki pages (summaries, topics), PKB folders (Resource/, Project/, Area/, Draft/) |
| Writes | Wiki page statuses (consumed, archived), PKB entries (edits proposed to Walker) |
| Removes | Cleared wiki entries (after Walker confirmation) |
| Tools used | `wiki_search`, `wiki_ensure_page`, `wiki_log_event`, `wiki_lint` |
| Supervised | Yes — all writes require Walker confirmation |

## Boundaries

- **Reads freely:** Wiki/, Resource/, Project/, Area/, Draft/, LIST.md
- **Writes only:** Wiki page statuses (consumed → archived → cleared), PKB entries (edits proposed, Walker confirms)
- **Never writes:** Wiki/meta/ (code-guarded), Wiki/inbox/ (code-guarded)
- **Never creates:** New wiki topics or summaries — that's Workshop's job
- **Never answers:** Knowledge questions ("What do we know about X?") — that's Map's job
- **Never plans:** Activity analysis or planning — that's Intelligence's job

## Session Flow

```
Walker starts Recall session
    │
    ▼
Load brain-wiki skill (shared rules)
Read WIKI_SCHEMA.md, meta/index.md
    │
    ▼
Walker provides entry (PKB path or wiki summary/topic)
    │
    ▼
┌─────────────────────────────────┐
│         REVIEW PHASE            │
│                                 │
│  Read wiki entry + PKB entry    │
│  Compare: gaps, drift, nuance   │
│  Present findings to Walker     │
│  Walker enhances PKB            │
│  Mark wiki → consumed           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│        CLEARING PHASE           │
│                                 │
│  Scan archived entries          │
│  Evaluate: superseded,          │
│    PKB covered, manual review   │
│  Present candidates to Walker   │
│  Walker confirms clears         │
│  Remove cleared entries         │
└─────────────────────────────────┘
    │
    ▼
wiki_log_event kind=review
```

## Integration with Other Agents

- **Workshop** produces `integrated` entries → Recall consumes them
- **Map** follows `consumed` links to PKB instead of reading wiki
- **Intelligence** tracks backlog: `integrated` entries awaiting Recall review
- **Intelligence** tracks archive: `archived` entries awaiting clearing

## Open Questions

- Should Recall sessions be on-demand only, or can Intelligence trigger a Recall session automatically when backlog is large?
- When clearing, should the entry be deleted or moved to a `cleared/` folder for a grace period before permanent deletion?
- Should Recall own the `consumed` status transition, or should that be a shared capability with Workshop?
