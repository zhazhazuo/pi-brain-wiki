# Non-Negotiable Rules

1. **Never directly edit `inbox/**` or `meta/**`.** These are code-guarded. Use `wiki_capture_source` for inbox and let the extension handle meta.
2. **Every source → summary page first.** No source influences canonical topics before it has a summary page with Integration Targets.
3. **Prefer updating existing pages over creating new ones.** Search first with `wiki_search`. Resolve or create safely with `wiki_ensure_page`.
4. **Use folder-qualified wikilinks** for all wiki-internal references:
   - `[[topics/functional-programming]]` not `[[Functional Programming]]`
   - `[[summaries/2026-05-05-Backus-Turing-Award]]` not `[[Backus Turing Award]]`
5. **Cite claims with stable source IDs.** `[[summaries/2026-05-05-Source|2026-05-05-Source]]` near the factual claim, not just once at the bottom.
6. **Keep uncertainty visible.** Use `Tensions / caveats` and `Open questions` sections. Never collapse ambiguity into false certainty.
7. **Query mode is read-only by default.** Only write to the wiki when explicitly asked or when performing an ingest/integrate workflow.
8. **Never write outside `Wiki/` without explicit permission.** The wiki domain is `Wiki/`. PARA folders (Resource/, Project/, Area/, Draft/) are read-only for agents.

**Exception: `LIST.md`** — agents may write sub-level agent lines and toggle checkboxes in LIST.md, following the LIST.md Protocol rules. This is the only PARA file agents may modify.

---

## Absorption Loop

Before touching any page, you MUST:

1. Re-read `meta/index.md` (or use `wiki_search`) — orient to current wiki state
2. Re-read every page you're about to edit — understand what's already there
3. Never edit blind — understand current state first

This applies to every session, every ingest, every edit. No exceptions.

---

## PARA Integration Rules

### Zone Map

| Zone | Path | Agent | Human |
|------|------|-------|-------|
| **Human-only** | `Area/` | Read only | Full control |
| **Agent-writable** | `Resource/` | Can create/edit | Full control |
| **Shared** | `LIST.md`, `Project/` | Can read/write | Full control |
| **Wiki (agent-owned)** | `Wiki/` | Full control | Read/browse |

**Note:** `Draft/` has moved into `Wiki/drafts/` as of v3. The agent uses `Wiki/drafts/` for work-in-progress. External `Draft/` at vault root is deprecated.

### New Tools

- `wiki_sync` — scan PARA vault structure, create/update wiki topic pages
- `wiki_triage` — read/add/suggest/flag_stale in LIST.md
- `wiki_project_sync` — scan/add_note/suggest_task in Project/
- `wiki_generate_workflow` — create standardized workflow pages after Walker approves an extracted workflow

### LIST.md AI Content Rule

All agent content in LIST.md must use:
```markdown
> 🤖 [AI] Agent note: ...
```

### Obsidian CLI First

Use Obsidian CLI for all supported operations (move, rename, create, read). Direct filesystem only for unsupported operations.

### Legacy Rules

- **Read freely:** Project/, Area/, Resource/, Draft/, LIST.md are all readable
- **One-way links:** Wiki → PARA only. Never the reverse.
- **Annotate external links with context:**
  ```markdown
  See [[Project/Widget Launch]] (status: active, deadline May 15).
  [[Area/1 CS/17 AI/LLM Memory]] — PKB entry covering the technical background.
  [[Resource/type-theory-paper.pdf]] — external reference on dependent types.
  ```
- **Never modify Area/ files.** Agent may write to Resource/ and Draft/.

**Semantic note:** `Area/` is the PKB (long-term knowledge, consumed wiki content). `Resource/` is external reference material (inputs from outside, raw notes). Follow wikilinks into `Area/` when you need depth on a consumed topic.

---

## Guardrails

- Never delete or modify files outside `Wiki/` without explicit permission
- Flag contradictions during ingest; surface to user, don't silently reconcile
- When uncertain about JD placement, propose with reasoning — don't assume
- After any wiki mutation, the extension auto-rebuilds `meta/` — trust this, don't manual-edit those files
