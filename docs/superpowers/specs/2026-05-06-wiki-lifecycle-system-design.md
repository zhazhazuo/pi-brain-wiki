> **Superseded by:** [Refined design](2026-05-06-wiki-lifecycle-one-pager.md) and [Implementation plan](../plans/2026-05-06-wiki-lifecycle.md)

# Wiki Lifecycle System — Design Spec

> Status: draft
> Created: 2026-05-06
> Author: Walker + agent

---

## Problem

The wiki is a staging area between raw sources and Walker's permanent PKB. Today it lacks:

1. A `consumed` status to mark entries Walker has internalized
2. Tool-level filtering to exclude archived entries from normal queries
3. Intelligence integration to track lifecycle backlogs
4. A mechanism to clear outdated archived entries

## Lifecycle

```
source → captured → integrated → consumed → archived → cleared
            │           │            │           │          │
            │           │            │           │          └─ removed
            │           │            │           └─ readable, excluded from agents
            │           │            └─ Walker owns this knowledge in PKB
            │           └─ wiki is the active source of truth
            └─ source ingested, not yet understood
```

| Status | Agents read? | PKB exists? | Meaning |
|--------|-------------|-------------|---------|
| `captured` | Yes | No | Source ingested, not yet integrated |
| `integrated` | Yes | Maybe | Content woven into wiki topics, Walker may or may not have read it |
| `consumed` | Yes (follow link) | Yes | Walker has internalized; PKB is the source of truth |
| `archived` | No (default) | Yes | Historical record, excluded from normal queries |
| `cleared` | N/A | Yes | Removed from wiki |

## System Changes

### 1. New statuses

Add `consumed` and `cleared` to the page lifecycle.

**Frontmatter changes:**

```yaml
# Summary page (after consumed)
status: consumed
consumed_at: 2026-05-10
pkb_path: Resource/1 CS/17 AI/LLM Memory.md

# Topic page (after consumed)
status: consumed
consumed_at: 2026-05-10
pkb_path: Resource/1 CS/17 AI/Type Theory.md
```

New frontmatter fields:
- `consumed_at` — ISO date when Walker confirmed internalization
- `pkb_path` — relative path to the PKB entry where this knowledge now lives

### 2. wiki_search — exclude archived by default

**Current behavior:** searches all pages regardless of status.

**New behavior:**
- Default: exclude `archived` and `cleared` entries from results
- Option: `includeArchived: true` to override (for historical queries)

```
wiki_search("functional programming")          → excludes archived
wiki_search("functional programming", includeArchived: true) → includes archived
```

### 3. wiki_lint — skip archived pages

**Current behavior:** checks all pages for links, orphans, frontmatter, duplicates, coverage, staleness.

**New behavior:**
- `links` check: skip archived entries (don't flag broken links to archived pages)
- `orphans` check: skip archived entries (they're expected to be orphaned)
- `frontmatter` check: validate new `consumed_at` and `pkb_path` fields for consumed entries
- `duplicates` check: skip archived entries
- `coverage` and `staleness`: skip archived entries

### 4. Map agent — follow consumed links to PKB

**Current behavior:** reads wiki topic pages directly.

**New behavior:**
- When a topic is `consumed`, Map reads the PKB entry instead of the wiki entry
- If PKB entry is missing or stale, Map surfaces: "This topic was consumed but the PKB entry at `Resource/...` may need updating"

```
Map searches for "type theory"
    │
    ├── topic status = integrated → read wiki topic page (current behavior)
    │
    └── topic status = consumed → read PKB entry at pkb_path
            │
            ├── PKB entry exists → use it as source of truth
            │
            └── PKB entry missing → flag to Walker: "consumed but PKB entry not found"
```

### 5. Intelligence agent — lifecycle backlog tracking

**New capability:** Intelligence tracks two backlogs:

**Backlog 1: Integrated → Consumed**
- Summaries and topics marked `integrated` that haven't been through Recall
- Intelligence surfaces: "15 summaries have been `integrated` for 2+ weeks without Recall review"

**Backlog 2: Archived → Cleared**
- Archived entries that haven't been evaluated for clearing
- Intelligence surfaces: "8 archived entries may be clearable (5 PKB covered, 2 superseded, 1 manual review)"

**Intelligence output format (new section in reviews):**

```markdown
## Lifecycle Backlog

### Awaiting Recall review (integrated → consumed)
- [[summaries/2026-04-20-Source-A]] — integrated 16 days ago, no PKB entry found
- [[summaries/2026-04-22-Source-B]] — integrated 14 days ago

### Awaiting clearing (archived → cleared)
- [[summaries/2026-03-01-Source-C]] — PKB covered: Resource/1 CS/17 AI/LLM Memory.md
- [[summaries/2026-03-05-Source-D]] — superseded by [[summaries/2026-04-10-Source-E]]
- [[summaries/2026-03-08-Source-F]] — manual review needed

### Recommendations
- Start Recall session for the 2 oldest integrated summaries
- Clear 5 PKB-covered archived entries (knowledge fully in Resource/)
```

### 6. wiki_scan_activity — include lifecycle data

**New fields in activity scan:**
- `integrated_count` — number of summaries/topics in `integrated` status
- `consumed_count` — number in `consumed` status
- `archived_count` — number in `archived` status
- `oldest_integrated` — date of the oldest `integrated` entry (backlog indicator)
- `clearable_candidates` — number of archived entries flagged for clearing

## Tools Affected

| Tool | Change |
|------|--------|
| `wiki_search` | Exclude archived by default, add `includeArchived` option |
| `wiki_lint` | Skip archived entries, validate consumed frontmatter |
| `wiki_log_event` | New event kinds: `consumed`, `archived`, `cleared` |
| `wiki_scan_activity` | Add lifecycle backlog data to output |
| `wiki_status` | Add consumed/archived/cleared counts to dashboard |

## Tools Unaffected

| Tool | Why |
|------|-----|
| `wiki_capture_source` | Capture produces `captured` entries — no change |
| `wiki_bootstrap` | One-time setup — no change |
| `wiki_ensure_page` | Creates/resolves pages — no change |
| `wiki_rebuild_meta` | Rebuilds registry — will naturally pick up new statuses |

## Filesystem Changes

No new directories. The lifecycle is tracked via frontmatter status, not folder location:

```
Wiki/
├── inbox/          ← source packets (unchanged)
├── pages/
│   ├── summaries/  ← all statuses live here (captured, integrated, consumed, archived)
│   ├── topics/     ← same
│   ├── plans/      ← unchanged
│   └── reviews/    ← unchanged
├── meta/           ← generated (unchanged structure, new event types in events.jsonl)
└── archive/        ← retired pages (unchanged, but clearing removes entries)
```

Entries move through status via frontmatter changes, not folder moves. This preserves path stability for wikilinks.

## Open Questions

- When clearing, should entries be deleted permanently or moved to a `cleared/` folder for a grace period?
- `consumed` entries remain searchable (they point to PKB entries via `pkb_path`, useful for Map agent to follow links)
- Should Intelligence auto-trigger Recall sessions when backlog exceeds a threshold?
- Should the `pkb_path` field support multiple PKB entries (one summary may inform several Resource/ files)?
