Here's the plan.

---

## Plan: Apply OKF Items 1–3

### Item 1 — Add `resource` field to frontmatter (15 min)

| Step | File | Change |
|---|---|---|
| 1a | `.wiki/templates/topic.md` | Add `resource:` (empty, optional) after `summary:` |
| 1b | `.wiki/templates/summary.md` | Add `resource:` after `summary:` |
| 1c | `.wiki/templates/plan.md` | Add `resource:` after `updated:` |
| 1d | `.wiki/templates/review.md` | Add `resource:` after `updated:` |
| 1e | `WIKI_SCHEMA.md` | Document `resource` under frontmatter conventions: "Optional URL or path to the external resource this page describes (e.g., a repo, a doc, a table)" |

No lint changes needed — optional field.

### Item 2 — index.md at directory levels (30 min)

| Step | File | What it does |
|---|---|---|
| 2a | `pages/topics/index.md` | Regenerated index: lists every topic page with its `summary` one-liner + `tags`. Sorted alphabetically. |
| 2b | `pages/summaries/index.md` | Same: all summary pages with summary + kind + status |
| 2c | `pages/plans/index.md` | All plan pages with date + status |
| 2d | `pages/reviews/index.md` | All review pages with period + status |
| 2e | Wire into `wiki_rebuild_meta` | Rebuild regenerates all four index.md files from registry data |
| 2f | Update `WIKI_SCHEMA.md` | Document these as "progressive disclosure indexes — regenerated, not hand-edited" |

These replace the flat `meta/index.md` for navigation. An external agent lands in `Wiki/pages/`, opens `topics/index.md`, sees the menu, navigates down.

### Item 3 — Conformance spec + lint rules (45 min)

| Step | File | What it does |
|---|---|---|
| 3a | `.wiki/CONFORMANCE.md` (new) | Formal spec in OKF's one-page style. Defines MUST/MUST NOT rules per page type. |
| 3b | Wire new rules | Add to `wiki_lint` frontmatter mode or create `conformance` mode |

**Rules to encode:**

```
REQUIRED FIELDS (per type)
  summary:  id, type, title, kind, status, captured_at, source_ids, summary
  topic:    id, type, title, status, summary
  plan:     id, type, title, status, date
  review:   id, type, title, status, period

VALID VALUES
  status ∈ {captured, integrated, archived}         — for summary
  status ∈ {draft, integrated, archived}            — for topic
  status ∈ {active, completed, archived}            — for plan/review
  type ∈ {summary, topic, plan, review}

RELATIONAL RULES
  summary.source_ids must be non-empty
  topic.source_ids must resolve to existing summary pages (if non-empty)
  summary.integrated_at must be set if status == "integrated"
  No wikilinks to inbox/** anywhere
  Every summary page's Integration targets must list at least one [[topics/...]]
```

| 3c | Run first conformance lint | Validate current wiki. Fix pre-existing violations (the 5 already caught). |

---

### Execution order

Items 1 and 2 are independent. Item 3 depends on Item 1 (the `resource` field should be in the conformance spec).

Suggested: **1 → 3 first** (small frontmatter changes, then formalize everything), **then 2** (indexes as the capstone that makes the whole thing navigable without tools).

**Proceed with this plan?** Any changes?
