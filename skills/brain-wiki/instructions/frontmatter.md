# Frontmatter Conventions

## Summary pages
```yaml
id: SRC-2026-05-05-001
type: summary
title: "Source Title"
status: captured
captured_at: 2026-05-05
integrated_at:
consumed_at:    # ISO date when Walker confirmed internalization (only for consumed status)
pkb_refs:       # Array of vault-relative paths to PKB entries (only for consumed status)
origin_type: url
origin_value: https://...
manifest_path: inbox/SRC-2026-05-05-001/manifest.json
raw_path: inbox/SRC-2026-05-05-001/extracted.md
aliases: []
tags: []
source_ids: [SRC-2026-05-05-001]
```

## Topic pages
```yaml
id: topic-functional-programming
type: topic
title: "Functional Programming"
aliases: [FP]
tags: [programming-paradigm]
status: integrated
updated: 2026-05-05
source_ids: []
consumed_at:    # ISO date when Walker confirmed internalization (only for consumed status)
pkb_refs:       # Array of vault-relative paths to PKB entries (only for consumed status)
links:
  - "[[topics/Lambda-Calculus]]"
  - "[[Area/1 CS/11 Programming Language/FP.md]]"
```

## Plan pages
```yaml
id: plan-2026-05-05
type: plan
title: "2026-05-05 Plan"
status: active
date: 2026-05-05
updated: 2026-05-05
```

## Review pages
```yaml
id: review-2026-W19
type: review
title: "2026 W19 Review"
status: active
period: 2026-W19
updated: 2026-05-05
```

## Workflow pages
```yaml
id: workflow-weekly-okr-report
type: workflow
title: "Weekly OKR Report"
status: active
updated: 2026-05-13
version: 1
triggers:
  - summarize my week
aliases:
  - summarize my week
tags: [okr, weekly]
summary: Draft a weekly OKR report.
```

Workflow body must include a `## Workflow YAML` fenced `yaml` block. Do not hand-roll new workflow pages; use `wiki_generate_workflow` so the schema stays consistent.
