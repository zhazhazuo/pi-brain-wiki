# Module: activity

## Responsibility

Scans vault and wiki activity for a given time period. Returns structured data about recent changes across wiki pages, PARA folders, and LIST.md inbox.

## Entry Points

- extensions/brain-wiki/src/activity.ts → scanActivity(), parseListMd(), buildListMdData()

## Key Files

- extensions/brain-wiki/src/activity.ts → all activity scanning logic including LIST.md parsing

## Constraints

- Scans both wiki (pages/, inbox/, meta/) and PARA (Resource/, Project/, Area/, Archive/, Draft/) directories
- Returns file-level change data with timestamps
- Default scan window is 7 days
- LIST.md parsing supports `**YYYY-MM-DD**` (primary) and `## [YYYY-MM-DD]` (backward compat) date headers

## LIST.md Parsing

`parseListMd(vaultRoot)` reads `LIST.md` at the vault root and returns `ListItem[]`. Each item has:
- `date` — from `**YYYY-MM-DD**` or `## [YYYY-MM-DD]` header
- `text` — the content after `- [ ]`, `- [x]`, or `- [>]`
- `done` / `inProgress` — from checkbox state
- `category` — auto-detected by `detectCategory()`
- `agentNotes[]` — lines matching `/^  A YYYY-MM-DDTHH:MM → /` under the item
- `daysSinceCreation` — computed from item date vs now

`detectCategory(text)` infers type from content patterns:
- URL → `"source"`
- `todo:` prefix → `"task"`
- `idea` / `plan` prefix → `"idea"` / `"plan"`
- meeting keywords → `"meeting-note"`
- task verbs (fix, update, submit, review, etc.) → `"task"`
- fallback → `"unknown"`

`buildListMdData(items)` computes:
- `unprocessedItems` — items where `done === false`
- `oldestUnprocessedDate` — earliest date among unprocessed items
- `unprocessedSourceUrls` — unprocessed items where `category === "source"`

## Agent Line Regex

```
const AGENT_LINE_RE = /^  A \d{4}-\d{2}-\d{2}T\d{2}:\d{2} → /;
```

Agent-written sub-lines use the format `  A YYYY-MM-DDTHH:MM → ...`. The parser collects these into the parent `ListItem.agentNotes[]`.

## Vault Activity Output

`vaultActivity` includes:
- `listItems: ListItem[]` — all parsed LIST.md items
- `listMdAnalysis: ListMdData` — structured analysis (unprocessed count, oldest date, source candidates)

## Lifecycle Backlog

`wiki_scan_activity` returns a `lifecycle` object containing:

- `integratedAwaitingRecall`: pages in `integrated` status for 14+ days
- `consumedReactivated`: consumed topics with newly integrated sources
- `clearableCandidates`: archived entries that may be eligible for clearing

## Scope Table

| Layer | Item | Description |
|-------|------|-------------|
| Implementation | extensions/brain-wiki/src/activity.ts | scanActivity(): walks vault and PARA directories, filters by modification time, returns structured activity data including LIST.md analysis |
| Implementation | extensions/brain-wiki/src/activity.ts | parseListMd(): reads LIST.md, returns typed ListItem[] with category detection and agent notes |
| Implementation | extensions/brain-wiki/src/activity.ts | buildListMdData(): computes unprocessed items, oldest date, source URL candidates |
| Implementation | extensions/brain-wiki/src/activity.ts | detectCategory(): infers item type from content patterns |
| Consumer | extensions/brain-wiki/index.ts | wiki_scan_activity tool handler calls scanActivity(), formats LIST.md analysis in output |
| Consumer | wiki-intel skill | uses listMdAnalysis for deep LIST.md health assessment in plans and reviews |
| Consumer | wiki-workshop skill | surfaces unprocessed source URLs from LIST.md as workshop candidates |
| Consumer | wiki-map skill | cross-references LIST.md items with knowledge queries |
