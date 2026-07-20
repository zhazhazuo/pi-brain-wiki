# PKB Mini-Search Convention (via context-mode)

Full-text search over the user's PKB (`Area/`, `Resource/`, `Draft/`, `Project/`, `LIST.md`) is provided by the external **`context-mode`** MCP server. This file defines how every brain-wiki agent uses it consistently. There is no separate `mini-search` skill or extension tool — `context-mode` is the engine; this convention is the wrapper.

Load this file on demand when the session will reason about PKB content (what the user already knows). It is optional for wiki-only queries and mandatory for the `wiki-workshop` Phase 3 (Understand & Connect).

## Scope and Source Labels

Index `.md` files only. Each PARA scope gets a stable `ctx_index` source label so `ctx_search` can target it or search the union:

| Scope | Path under vault root | `ctx_index` source label |
|------|----------------------|--------------------------|
| Area (PKB) | `Area/` | `pkb-area` |
| Resource | `Resource/` | `pkb-resource` |
| Draft | `Draft/` | `pkb-draft` |
| Project | `Project/` | `pkb-project` |
| Inbound | `LIST.md` (root) | `pkb-list` |

Mental alias `pkb-all`: search every scope. Implement as **one `ctx_search` call per scope, results merged in the agent** (or issue parallel per-scope calls). **Never** search PKB with the `source` parameter omitted — context-mode's store is shared with web fetches (`ctx_fetch_and_index`) and session memory, so an unfiltered `ctx_search` will surface non-PKB content (the source you just captured, web cache, prior session events) and silently masquerade them as "what the user already knows." Be explicit about the shelf.

## Index Recipe — MANDATORY pre-gate

**This is a hard gate, not housekeeping.** You may not call `ctx_search` against a PKB scope until that scope is indexed under its label. If you skip this, `ctx_search` will return "No results found" for terms that genuinely exist in the PKB, because the PKB content was never loaded into the FTS5 store — and the platform you build will be missing exactly what Phase 3 exists to surface. Do not learn this the hard way.

Resolve the vault root using the normal brain-wiki path resolution. Do not invent a new root concept. Then index all five scopes. Indexing is idempotent and cheap (file-hash staleness skips unchanged files), so running the full recipe every session that needs PKB reasoning is correct, not wasteful:

```
ctx_index(path: <vault-root>/Area,    source: "pkb-area",    extensions: ["md"])
ctx_index(path: <vault-root>/Resource, source: "pkb-resource", extensions: ["md"])
ctx_index(path: <vault-root>/Draft,   source: "pkb-draft",    extensions: ["md"])
ctx_index(path: <vault-root>/Project,  source: "pkb-project",  extensions: ["md"])
ctx_index(path: <vault-root>/LIST.md,  source: "pkb-list")
```

After indexing, confirm to the calling agent with file counts per scope before any `ctx_search` (e.g. "PKB indexed: Area N, Resource M, Draft K, Project L, LIST 1"). If a scope is unavailable, note it; do not silently proceed as if the full PKB is searchable.

Force refresh only the scope that needs it — when `ctx_search` flags staleness or Walker asks:

```
ctx_index(path: <vault-root>/Area, source: "pkb-area", extensions: ["md"], force: true)
```

Force refresh only the scope that needs it:

```
ctx_index(path: <vault-root>/Area, source: "pkb-area", extensions: ["md"], force: true)
```

## Query Usage

```
ctx_search(queries: [...terms], source: "pkb-area", limit: 3)
  → returns per-query ranked windows with file path + matched snippet
```

Rules:

- **Always pass a `source` label.** `source` is **required**, not optional, for PKB search. The context-mode store is global (web fetches + session memory + indexed content share it); an unfiltered `ctx_search` does not mean "broad PKB," it means "everything, mostly non-PKB."
- For broad PKB recall across shelves, issue one `ctx_search` per scope (`pkb-area`, `pkb-resource`, `pkb-draft`, `pkb-project`) and merge the windows in the agent. Never rely on omitting `source`.
- Prefer 2-4 specific technical terms per query.
- Batch all related questions into one `ctx_search` call — do not issue one call per term.
- Use `sort: "timeline"` only when chronological provenance matters; default is relevance.
- Never print raw PKB file contents. Print only the returned windows (file path + snippet).
- If a result flags staleness, note it to Walker and offer a targeted `ctx_index force` for that scope.
- To read a cited file in full afterward, use `read` — never `cat`/`grep` over the PKB.

### Wrong-corpus sentinel (run on every result)

Before trusting `ctx_search` windows as PKB knowledge, sanity-check the returned paths. If you see any of these, the query hit the wrong corpus — stop, re-index the PKB scopes, and re-run before using any windows:

- a source label containing `::` (e.g. `cerebras-kb-cached::https://...`) → that is a `ctx_fetch_and_index` web cache, not the PKB
- a path beginning with `[current-session |` or referencing a `source:` field → that is session memory or a web fetch, not a PKB note
- a path returning `Wiki/No matches found.` → that is `wiki_search`-shaped output, not an FTS5 window; you are likely not running over PKB at all
- zero hits across every query for a substantive source → see "Empty PKB" failure mode

## Role — `wiki_search` vs `ctx_search`

These are two layers, not two searches over the same thing. Do not merge or substitute them.

| Need | Tool | Why |
|------|------|-----|
| Orient to the wiki; find integration targets; graph-discovery entry | `wiki_search` (registry, typed) | Returns typed page entries with `type`/`path`/`sourceIds`/`status` that `wiki_graph_find` and `wiki_graph_traverse` consume. Graph layer needs page nodes, not FTS passages |
| Recall what the PKB text actually says; ground the platform in Walker's existing knowledge | `ctx_search` (FTS5, source-scoped to `pkb-*`) | Returns passage windows from PKB content the wiki has not distilled. No page type, no integration semantics — raw recall |

The single output entrance for the user is the **platform** (Phase 3.3), not a single search tool. The platform composes wiki_search hits + ctx_search windows + the source. Two tools, one synthesis.

## Guardrails

- **Read-only.** Searching the PKB never writes. `brain-wiki`'s `protect: ["Area/**", ...]` is honored.
- **No shell spelunking.** Once indexed, queries go through `ctx_search`, not `grep`/`find`/`cat`.
- **Byte isolation.** Consume only `ctx_search` returned windows, never full file bytes, unless a deliberate follow-up `read` is needed to interpret a window.
- **Scope discipline.** A query scoped to `pkb-area` must not surface `pkb-resource` windows — pass the label explicitly. Never omit `source`.
- **Graph-first still holds.** PKB search **augments** graph discovery (`wiki_search` + `wiki_graph_find`). It does not replace it. Orient to the wiki graph first; use PKB search to ground the new content in what the user already knows.

## Failure Modes — Graceful Degradation

If `context-mode` is unavailable, degrade; never block the session.

1. Run `ctx_doctor` once at startup if PKB reasoning is expected. If it reports missing, fall back.
2. Fallback: use `wiki_graph_find` over PKB nodes only (the graph already contains PKB adjacency). Tell Walker: "PKB full-text search unavailable (`context-mode` missing); platform built from wiki graph only."
3. If a PARA scope is empty, indexing succeeds with zero files; queries return empty, not error. Report "no existing PKB notes found for [terms]; platform is the source alone."
4. If the FTS5 store is corrupt, `ctx_doctor` flags it. Recommend `ctx_purge` plus re-index; never silently rebuild.

## When to Load This File

| Agent | Load `mini-search.md`? |
|------|------------------------|
| `wiki-workshop` Phase 3 (Understand & Connect) | **Yes, mandatory** |
| `wiki-map` Level 3 deep dive into a long Area/ page | Recommended |
| `wiki-intel` coverage-gap analysis (topic exists, no PKB note findable) | Recommended |
| Any session reasoning about "what does the user already know about X" | Yes |
| Wiki-only queries with no PKB depth needed | No |