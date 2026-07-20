# Output Format

## Plan Pages

```markdown
# YYYY-MM-DD Plan

## Date / Period
[Date or date range]

## Priorities
Ordered list of what matters most, with justification from activity data.

## Timeboxed blocks
Specific time allocations with outcomes.

## Dependencies
What blocks each priority, and what it unblocks.

## Notes
Context that doesn't fit neatly above.
```

## Review Pages

```markdown
# YYYY-Www Review

## Period
[Week or date range]

## LIST.md health
- Backlog: 8 items (3 sources, 3 tasks, 1 idea, 1 meeting note)
- Oldest unprocessed: 2026-04-28 (9 days)
- Throughput: 4 items captured, 2 items processed this period
- Stuck: "Blog: [URL]" from April 28 — not yet captured
- Pattern: most items are source URLs, suggesting a research-heavy week

## Activity clusters
Synthesized themes, not file lists.
"Functional programming deep dive" not "edited 3 FP files."

## Neglected areas
What hasn't gotten attention, with evidence.
"[[Project/Widget Launch]] — deadline May 15, no activity in 5 days."

## Emerging patterns
New connections or themes across activity.

## Recommendations
Specific, actionable next steps with reasoning, grounded in LIST.md state.

### Lifecycle Backlog

#### Awaiting graduation (integrated → consumed)
- [[summaries/Source-A]] — integrated 16 days ago, no PKB entry found

#### Learning frontier (open edges)
- [edge-1] "How does X reconcile with Y?" — [[summaries/Source-A]], open 21d
- [edge-2] "..." — [[summaries/Source-B]], exploring 7d

#### Awaiting clearing (archived → cleared)
- [[summaries/Source-C]] — PKB covered: [[Area/1 CS/17 AI/LLM Memory]]

#### Reactivated (consumed with new sources)
- [[topics/Type-Theory]] — new integrated source pointing at consumed topic
```
