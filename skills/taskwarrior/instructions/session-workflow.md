# Session Workflow

```
Session start
  ├── wiki_task_scan()   → surface stale LIST.md items, propose promotions
  ├── wiki_week()        → refresh weekly dashboard
  │
  During session
  ├── Walker: "promote X" → wiki_task(promote) with validation
  ├── Walker: "what's this week?" → task export filters (real-time)
  ├── Agent completes work → wiki_task(done)
  │
  Session end
  └── wiki_week()        → refresh WEEK.md
```

---

## LIST.md Draining

1. `wiki_task_scan(scope: "list_md")` finds items older than 7 days
2. Propose promotion with all required fields
3. On approval → `wiki_task(promote)`
4. Append agent line to LIST.md: `A 2026-06-05T10:00 → Promoted to TW #20 [AI] estimate:1`
5. Toggle `[ ]` → `[x]` in LIST.md

---

## Bidirectional Linking

**Task side:**
```bash
task <id> annotate "Wiki: [[topics/type-systems]]"
```

**Wiki topic side** — add `## Tasks` section:
```markdown
## Tasks
- [ ] #3 RD: Blog on type systems (scheduled: Jun 5, estimate: 1)
```

Maintain both sides. When task completes, update topic page if it produced knowledge.
