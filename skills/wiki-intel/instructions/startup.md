# Startup Checklist

Before any intelligence session, load and read in order:

1. Load the `brain-wiki` skill (shared rules) — **required**
2. Read `Wiki/discussions/route.md` — active discussions, where we left off
3. Read `Wiki/meta/wiki-digest.md` — current wiki state: stats, events, stale items
4. Read `Wiki/WIKI_SCHEMA.md` — conventions and structure
5. Read `Wiki/meta/index.md` — orient to current wiki state
6. Run `wiki_scan_activity` — recent activity across wiki and vault
7. Read `LIST.md` — pending items and inbox
   - Pay special attention to `listMdAnalysis` in the scan result:
     - `oldestUnprocessedDate` — how long has the oldest item been sitting?
     - `unprocessedSourceUrls` — un-captured URLs that should go through workshop
     - `unprocessedItems` — total backlog count, grouped by category
8. Scan Project/ and Area/ frontmatter — active work, statuses, priorities, deadlines; Area/ is the PKB and drives responsibility signals
