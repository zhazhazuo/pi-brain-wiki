# Obsidian CLI Command Audit

> Companion to: `2026-06-15-graph-first-architecture-design.md`
> Date: 2026-06-15

---

## 1. Executive Summary

The extension is already meaningfully integrated with Obsidian CLI. The gap is not adoption from zero; the gap is incomplete architectural promotion.

Today:
- user-facing wiki search requires Obsidian CLI, but only searches `Wiki/`
- lint already uses native graph commands
- registry rebuild already uses CLI backlinks to enrich wiki pages with external references
- several vault-visible read/write paths already flow through `obsidian-io.ts`

Missing:
- vault-wide search in the public tool surface
- outgoing-link and heading-aware graph helpers
- mandatory graph discovery before knowledge writes
- consistent removal of direct filesystem fallbacks for vault-visible content

---

## 2. Current Command Surface

### Commands exposed in `ObsidianClient`

Implemented client methods currently include:
- `version`
- `backlinks`
- `search:context`
- `read`
- `create`
- `append`
- `prepend`
- `move`
- `rename`
- `delete`
- `unresolved`
- `orphans`
- `deadends`
- `property:set`
- `property:read`
- `properties`
- `search`
- `template:read`
- `files`
- `folders`

This is already a substantial usable surface.

### Commands confirmed in active extension usage

Used in the current codebase:
- `version` for CLI health checks
- `search:context` for `wiki_search`
- `backlinks` for registry enrichment and lint
- `unresolved`, `orphans`, `deadends` for lint
- `properties`, `property:read`, `property:set` in markdown/property workflows
- `create`, `append`, `prepend` in vault-visible write helpers
- `files`, `folders` via directory listing helpers
- `template:read` during scaffold/bootstrap paths

Conclusion:
- the extension is already CLI-backed for important paths
- the tool surface simply has not caught up to that reality

---

## 3. Where the Real Gaps Are

### Gap A: `search()` exists but is not promoted

This is the most important immediate gap.

Facts:
- `ObsidianClient.search()` exists
- public `wiki_search` still uses `search:context`
- the current search path is scoped to `Wiki/`

Impact:
- the agent cannot discover PKB notes through the main public search tool
- users still need indirect workflows to reach relevant `Area/`, `Project/`, and `Resource/` content

Priority:
- P0

### Gap B: no outgoing-edge helper

The extension currently reasons primarily from:
- backlinks
- parsed markdown links

Missing:
- `links(file)` as a first-class CLI helper

Impact:
- forward traversal stays more expensive than it should be
- bridge/discovery tools must either parse bodies or stay backlink-only

Priority:
- P0/P1 depending on whether `wiki_graph_find` can ship first with backlink-heavy logic

### Gap C: no heading-aware lightweight read

The extension can read whole files, but it lacks a targeted outline helper.

Missing:
- `outline(file)` or equivalent heading-aware extraction

Impact:
- graph discovery must do more full-body reads than necessary
- "What does this note define?" remains heavier than it should be

Priority:
- P1

### Gap D: vault-visible writes are not consistently CLI-only

Some modules still fall back to direct filesystem access when no client is passed.

Notable areas:
- LIST sync workflows
- LIST triage workflows
- some project-note paths

Impact:
- the architectural boundary is inconsistent
- vault-visible user content can bypass the running Obsidian app

Priority:
- P1

### Gap E: metadata discovery helpers are absent

Not yet implemented:
- `tags()`
- `tag(name)`
- `aliases()`

Impact:
- lower than search/backlinks/links
- useful for richer PKB conventions and taxonomy-aware discovery

Priority:
- P2

---

## 4. Reframed Capability Inventory

### Already strong

- Vault-visible markdown/property IO boundary exists
- CLI health checks are enforced for user-facing operations
- wiki search is already CLI-backed
- lint already uses native graph commands
- registry rebuild already consumes external backlink data

### Underused but already available

- `search()` is implemented and ready to adopt

### Missing but high-leverage

- `links()`
- `outline()`

### Useful later

- `tags()`
- `tag()`
- `aliases()`
- `recents()`
- `history()`
- `diff()`

---

## 5. Recommended Priority

### P0

1. Promote vault-wide `search()` into `wiki_search(scope="vault")`
2. Build a shared graph discovery module on top of existing client methods

Why:
- highest user-visible value
- lowest implementation risk
- no client protocol redesign required

### P1

1. Add `links(file)`
2. Add `outline(file)`
3. Add graph-aware public tools
4. Tighten vault-visible IO fallbacks in LIST/project flows

Why:
- unlock better graph traversal
- reduce manual markdown parsing
- make the architecture internally consistent

### P2

1. Add `tags()`
2. Add `tag(name)`
3. Add `aliases()`

Why:
- these improve taxonomy-aware PKB discovery
- they are not blockers for the first graph-first release

---

## 6. Commands Worth Ignoring for Now

Low-value for this upgrade:
- UI-opening commands
- theme/plugin management
- app lifecycle controls
- devtools/eval-style commands in ordinary workflows
- restore/history mutation flows

Reason:
- they do not materially improve graph-first knowledge work

---

## 7. Architectural Recommendation

Use this audit to guide one clear boundary:

```text
Obsidian CLI should own vault-visible discovery, graph traversal, and markdown/property mutation.
Filesystem code should remain for internal extension artifacts and non-vault bootstrap/meta state.
```

That boundary is strong enough to satisfy "max leverage the Obsidian CLI" without pretending every internal extension file must also move through Obsidian.

---

## 8. Immediate Next Steps

1. Ship `wiki_search(scope="vault")` using `ObsidianClient.search()`
2. Add `src/graph.ts` as the shared vault-discovery layer
3. Add `wiki_graph_find`
4. Add `links()` and `outline()` to the client
5. Integrate graph discovery into `wiki_capture_source` and `wiki_ensure_page`
6. Audit and remove remaining direct `fs` fallbacks for vault-visible content where CLI paths already exist
