# Intelligence Protocols

## For Plan Requests ("What should I work on?")

```
1. Read wiki_scan_activity → recent activity patterns
2. Read LIST.md → pending items
   - Age-sort items: oldest unprocessed first
   - Category-sort: separate sources-to-capture from tasks from ideas
   - Cross-reference LIST.md URLs with wiki registry → flag un-captured sources
   - Identify stuck items (same item appears across multiple dates unprocessed)
   - Surface pattern: "You've had an unprocessed task about [X] since May 3."
3. Read Project/ frontmatter → active work, priorities, deadlines
4. Read Area/ frontmatter → responsibilities needing attention
5. Read wiki/meta/index.md → knowledge state
6. Read recent wiki events → what knowledge was recently added/updated
7. Read Draft/ maturity → "ready to file" candidates
8. Check lifecycle backlog from `wiki_scan_activity` output:
   - Integrated entries awaiting Recall review (2+ weeks old)
   - Archived entries that may be clearable
   - Consumed topics with new sources (needs reactivation)

Synthesize into:
- LIST.md health: backlog size, oldest item, un-captured sources
- What's active and needs attention (deadlines, blocked projects)
- What's been neglected (areas with no recent activity, stuck LIST.md items)
- What's emerging (new wiki topics, Draft pages maturing)
- Recommended priorities with timeboxed blocks, grounded in LIST.md state
```

## For Review Requests ("What was I focused on?")

```
1. Read wiki_scan_activity → activity in the period
2. Read wiki/meta/events.jsonl → structured event log
3. Cross-reference with wiki pages → what knowledge was built
4. Cross-reference with Project/ statuses → what work was done
5. Cross-reference LIST.md state → what was added vs. what was processed
   - Items added during the period: new inbound
   - Items completed during the period: throughput
   - Items that crossed into the period without action: growing backlog

Synthesize into:
- Activity clusters (what topics/areas got attention)
- Neglected areas (what fell off, what's stuck in LIST.md)
- LIST.md throughput: items captured vs. items processed
- Emerging patterns (new connections, recurring themes)
- Recommendations (where to invest next)
```

## For Periodic Reviews (Weekly/Monthly)

Same as review, plus:
- Compare activity against stated priorities (Project/ frontmatter)
- Identify "always postponed" items in LIST.md — items that persist across weeks
- Category trend analysis: is the mix of LIST.md items shifting? More sources vs. more tasks?
- LIST.md aging report: items by age bucket (<3d, <1w, <2w, 2w+)
- Check Draft/ maturity — any seedlings ready to become evergreen?
- Check wiki topic coverage — are there gaps that need sources?
- **PKB coverage-gap analysis (optional):** load `brain-wiki/instructions/mini-search.md`, index `pkb-area` per its recipe (hard gate), and for wiki topics that look thin run `ctx_search` with `source: "pkb-area"` and the topic's terms. If a topic exists but no PKB note is findable, flag it as a coverage gap. If PKB notes exist but no wiki topic distills them, flag it as a distillation gap (candidate workshop session). Never omit `source` — context-mode's store is shared with web fetches and session memory.
