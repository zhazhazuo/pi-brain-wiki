# Brain Wiki User Guide

> How to use the pi-brain-wiki extension day-to-day.

---

## Quick Start

### 1. Bootstrap your vault

```bash
pi -e ./extensions/brain-wiki/index.ts
```

In the chat:
```
@wiki_bootstrap title="My Wiki" domain="Research"
```

This creates the `Wiki/` folder inside your vault with:
- `inbox/` — for captured sources
- `drafts/` — for work-in-progress
- `discussions/` — for session records
- `pages/{topics,summaries,plans,reviews}/`
- `meta/` — auto-generated registry, events, digest

### 2. Sync PARA structure (once)

```
@wiki_sync scope="all"
```

This seeds wiki topic pages from your existing `Area/`, `Resource/`, and `Project/` folders. Run again only when you add new PARA folders.

### 3. Start working

The agent now reads `Wiki/meta/wiki-digest.md` at session start and knows your wiki state.

---

## The Three Agents

| Agent | Invoke | What it does |
|-------|--------|-------------|
| **Map** | Ask "What do we know about X?" | Searches wiki, reads topics, gives wiki-style answers with citations |
| **Workshop** | Give a URL/file/text | Captures sources, discusses takeaways, integrates into topics |
| **Intelligence** | Ask "What should I focus on?" | Analyzes activity, flags neglected areas, drafts plans |

**Rule of thumb:**
- **Read** → Map
- **Write** (with your supervision) → Workshop
- **Reflect** → Intelligence

---

## The Four Workflows

### 1. Source Consumption — "Discuss before recording"

```
You: "Here's an article about type systems"
     ↓
Agent: captures to inbox/ + summary page
       discusses key takeaways with you
       identifies integration targets
       updates topic pages
       records discussion in discussions/
```

**Key point:** Nothing goes into `Area/` (your PKB) automatically. The wiki holds the synthesis. You decide when knowledge is ready for `Area/`.

### 2. Project Planning — "Wiki first, PARA on demand"

```
You: "I want to plan a new project"
     ↓
Agent: reads wiki context first (topics, past plans, sources)
       reaches into PARA only if wiki lacks context
       drafts plan in Wiki/pages/plans/
       iterates with you
```

**You** create the `Project/` folder when you're ready. The agent does **not** create PARA folders autonomously.

### 3. Intelligence / Review — "Digest first"

```
You: "What should I focus on this week?"
     ↓
Agent: reads meta/wiki-digest.md
       checks discussions/route.md for continuity
       looks at LIST.md for pending items
       scans PARA only for verification
       gives synthesized answer, not file lists
```

### 4. Real Wiki — "Wiki-style descriptions"

```
You: "What is Project A?"
     ↓
Agent: reads wiki topic page (already has synthesis)
       gives narrative answer with purpose, timeline, status
       checks PARA frontmatter only to verify details
```

---

## Session Start Sequence

Every wiki session, the agent automatically reads:

1. `Wiki/discussions/route.md` — where we left off
2. `Wiki/meta/wiki-digest.md` — current wiki state
3. `LIST.md` — what's pending from you

Then it responds to your question.

---

## Zone Rules — What the Agent Can Do

| Zone | Path | You | Agent |
|------|------|-----|-------|
| **PKB** | `Area/` | Full control | Read only |
| **Active work** | `Project/` | Full control | Read + add notes |
| **Raw refs** | `Resource/` | Full control | Read only |
| **Routing** | `LIST.md` | Full control | Read + add items + suggest |
| **Wiki** | `Wiki/` | Read/browse | Full control |

**Key rule:** The agent **never autonomously writes to PARA**. It proposes; you decide.

---

## Key Tools

| Tool | When to use |
|------|-------------|
| `wiki_bootstrap` | First time only — initialize the wiki |
| `wiki_sync` | Once during setup, then when new PARA folders added |
| `wiki_capture_source` | When you find a URL/file/text to ingest |
| `wiki_search` | Before reading — find relevant pages |
| `wiki_ensure_page` | Before creating — avoid duplicates |
| `wiki_lint` | Periodic health check — structural issues and page-type conformance |
| `wiki_scan_activity` | Intelligence sessions — what's happening |
| `wiki_rebuild_meta` | Force rebuild if meta feels stale |
| `wiki_triage` | Manage LIST.md — add items, flag stale |
| `wiki_project_sync` | Add notes or suggest tasks for projects |

---

## Lifecycle — Page States

```
draft → integrated → consumed → archived → cleared
```

| State | Meaning | Who transitions |
|-------|---------|-----------------|
| `draft` | Created, not enriched | Auto on topic creation |
| `integrated` | Has substantive synthesis | Agent after workshop |
| `consumed` | You internalized it; PKB is truth | You via `/wiki-consumed` command |
| `archived` | Outdated | You or agent suggestion |
| `cleared` | Removed after grace period | You or agent suggestion |

**Reactivation:** If a new source integrates into a `consumed` topic, it flips back to `integrated` automatically.

---

## LIST.md Protocol

Your `LIST.md` is the shared inbox. Format:

```markdown
**2026-05-09**
- [ ] https://example.com/blog-post about type systems
- [ ] Idea: automate wiki linting on git hook
- [ ] Fix: broken link in Project/Widget Launch
```

The agent:
- Reads it every session
- Identifies unprocessed items
- Suggests actions
- Adds agent lines under your items:
  ```markdown
    A 2026-05-09T14:30 → Captured as SRC-2026-05-09-001
  ```

**Never marks your items done without asking.**

---

## Discussion System

Each significant conversation gets a record:

```
Wiki/discussions/
├── route.md           ← index (active, recent, archive)
└── 2026-05-09-topic.md ← briefing file
```

**States:**
- `ongoing` — in progress
- `finish` — got result, not in PKB yet
- `archive` — internalized into PKB
- `discord` — dropped

The agent reads `route.md` at session start to know where you left off.

---

## Common Patterns

### "I found a great article"
```
You: "Capture this: https://example.com/article"
     ↓
Agent: wiki_capture_source → creates inbox packet + summary stub
       You discuss takeaways
       Agent identifies integration targets
       You confirm
       Agent updates topics, marks summary integrated
```

### "What do we know about X?"
```
You: "What do we know about functional programming?"
     ↓
Agent: wiki_search("functional programming")
       Reads topic summaries
       Synthesizes answer with citations
       Suggests workshop if topic is thin
```

### "What should I work on?"
```
You: "What should I focus on this week?"
     ↓
Agent: reads wiki-digest.md
       Reads LIST.md backlog
       Scans Project/ statuses
       Synthesizes: active work, neglected areas, recommendations
```

---

## Digests and Events

- **`meta/wiki-digest.md`** — current state, rebuilt after every change. Read this first.
- **`meta/log.md`** — human-readable event history
- **`meta/events.jsonl`** — machine-readable event log
- **`meta/registry.json`** — compiled page index
- **`meta/backlinks.json`** — link graph

**Don't hand-edit these.** They're auto-generated.

---

## Migration Notes

### If you have an external `Draft/` folder

The agent now uses `Wiki/drafts/` instead. External `Draft/` still works but is deprecated:

- Phase 1 (now): Agent uses `Wiki/drafts/`. External `Draft/` untouched.
- Phase 2 (next): Lint warns about external `Draft/`.
- Phase 3: External `Draft/` removed from agent access.

Move files manually when ready. Obsidian handles link updates.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent seems confused about wiki state | Run `@wiki_rebuild_meta` |
| Lint reports broken links | Check if target page exists; use `wiki_ensure_page` |
| Topic page is flagged stale | Check if PARA folder was modified; run `wiki_sync` |
| Digest feels out of date | It's rebuilt on-change; force with `wiki_rebuild_meta` |
| Agent can't find a page | Use `wiki_search` first — the registry is the index |

---

## Design Principles

1. **Wiki first, PARA on demand.** The agent reads wiki digest before scanning raw PARA.
2. **Parallel layers, not pipeline.** Wiki doesn't feed into PARA. They coexist.
3. **Agent proposes, you decide.** Agent never autonomously writes to PARA.
4. **Discuss before recording.** Sources are consumed in wiki before becoming PKB.
5. **Everything is a draft first.** Plans start in `Wiki/drafts/`, move to `pages/plans/` when committed.
