# Startup Protocol

Every wiki session starts by reading these files in order:

1. **`Wiki/discussions/route.md`** — active discussions, where we left off
2. **`Wiki/meta/wiki-digest.md`** — current wiki state: stats, events, stale items
3. **`Wiki/WIKI_SCHEMA.md`** — vault conventions, page types, naming rules
4. **`Wiki/.wiki/config.json`** — directory paths, page types, protected paths
5. **`Wiki/meta/index.md`** — current page catalog (or use `wiki_search` if index is large)
6. **`Wiki/meta/workflows.md`** — active/draft workflow route page
7. **`LIST.md`** — the inbound command center: pending items, sources to capture, tasks, ideas

8. **PKB search (on demand):** if this session will reason about what Walker already knows — `wiki-workshop` Phase 3, `wiki-map` deep dives, `wiki-intel` coverage gaps — load `instructions/mini-search.md` and ensure the PARA scopes are indexed per its recipe. Skip for wiki-only queries.

Never skip this. Never edit without re-orienting to current wiki state.

For source or integration work, follow this discovery order:

1. `wiki_search` with `scope=vault`
2. `wiki_graph_find` on the main terms
3. `wiki_graph_traverse` or `wiki_graph_bridge` when a candidate page already exists
4. `wiki_capture_source` or `wiki_ensure_page` only after the relevant pages are identified

Do not use `bash`, `find`, or `grep` to locate wiki content or files when a native wiki tool can answer the question.
If a capture tool already returned `sourcePagePath`, use that path directly. Do not rediscover the file with shell commands.

---

## LIST.md Protocol

LIST.md is the single front door for everything Walker receives. It lives at vault root (outside `Wiki/`) and uses this format:

```markdown
**2026-05-07**
- [ ] https://example.com/blog-post about type systems
- [ ] Design review feedback from Sarah
- [ ] Idea: automate wiki linting on git hook
```

**At every session start, all agents must:**

1. Read `LIST.md` in full
2. Identify **unprocessed** items (`[ ]` and `[>]`) — these are backlog
3. Categorize each by content: source URLs, tasks, ideas, meeting notes, plans
4. Surface findings to Walker before doing anything else:
   - "3 unprocessed items. One is a blog link — want me to capture it?"
   - "One task from May 3 is still open."
   - "2 ideas in LIST.md I haven't seen before."
5. If the session is a workshop, ask: "There's a URL in LIST.md that hasn't been captured. Process it first?"
6. If the session is a query, check: "There's an idea in LIST.md related to your question — want me to incorporate it?"
7. If the session is intelligence, include LIST.md health in the analysis (see Intel skill)

**Agent mark format — every agent-written line uses exactly this format:**

```markdown
  A 2026-05-07T14:30 → Captured as SRC-2026-05-07-001
  A 2026-05-07T14:35 → Integrated into [[topics/wireframe-design]]
```

- Always indented with 2 spaces under the user's item
- Always starts with `A YYYY-MM-DDTHH:MM →`
- Never adds new top-level `- [ ]` items
- Never reorders or edits existing entries
- Only toggles `[ ]` → `[>]` (in-progress) and `[ ]` → `[x]` (done/processed)
- Every toggle appends an agent line with timestamp

**Agent writing rules:**
- Agent may write sub-level lines under any existing item
- Agent may toggle checkboxes: `[ ]` → `[>]` or `[ ]` → `[x]`
- Agent may NOT create new `- [ ]` top-level items
- Agent may NOT edit or reorder existing user items
- Agent may NOT toggle `[>]` or `[x]` backwards

---

## Discussion System

The wiki maintains a discussion record in `Wiki/discussions/` for session continuity.

**At session start:**
1. Read `Wiki/discussions/route.md`
2. Check if there are active discussions (state: `ongoing`)
3. If continuing an active discussion, read the briefing file

**During a discussion:**
1. Create or update the briefing file (`Wiki/discussions/YYYY-MM-DD-topic.md`)
2. Record: context, key points, outcomes, open questions
3. Update `route.md` to reflect the discussion state

**Discussion states:**
| State | Meaning |
|-------|---------|
| `ongoing` | Started, no result yet |
| `finish` | Got result, not internalized into PKB |
| `archive` | Internalized into PKB |
| `discord` | Started, then dropped |

**Use the extension tools first.** Avoid shell `find`/`grep`/manual file spelunking for wiki-visible work when a native tool exists.
Captured source packets and generated summary pages already come back with paths. Use those paths directly.
