# Graph-First Architecture - Design Specification

> Scope: upgrade `pi-brain-wiki` from a wiki-scoped organizer into a vault-aware PKB assistant by promoting existing Obsidian CLI capabilities into the main architecture.
> Status: draft
> Date: 2026-06-15

---

## 1. Problem Statement

### 1.1 What is missing today

The extension already uses Obsidian CLI for important vault-visible operations, but the product surface is still centered on the `Wiki/` subtree.

Current behavior:
- `wiki_search` only returns wiki pages, even though the client already exposes vault-wide `search()` support.
- `wiki_capture_source` and `wiki_ensure_page` can create or update wiki content without first discovering related PKB entries.
- `wiki_lint` uses native graph commands for unresolved/orphan/dead-end checks, but it does not treat PKB connectivity as a first-class quality signal.
- LIST and project workflows still contain direct filesystem fallbacks, which weakens the "Obsidian is the source of truth" boundary for vault-visible content.

### 1.2 Product impact

This leaves the extension in an awkward middle state:
- stronger than a plain file tool
- weaker than a graph-native assistant

The result is predictable:
- sources are captured but not consistently connected to existing PKB knowledge
- wiki topic pages accumulate with weak PKB linkage
- the agent can maintain wiki structure, but cannot reliably answer "what does the rest of the vault already know about this?"

### 1.3 The real gap

The gap is not "we do not use Obsidian CLI."

The gap is:

```text
Current: CLI is used as an implementation detail for selected wiki operations.
Target: CLI becomes the default graph/navigation boundary for all vault-visible knowledge work.
```

---

## 2. Architectural Principles

### Principle 1: Search for entry points, then traverse edges

Graph-first does not mean "never search text."

The correct flow is:
1. use vault-wide search to discover candidate entry nodes
2. use backlinks and outgoing links to expand the neighborhood
3. read only the smallest connected set of files needed for synthesis

Example:

```text
Agent wants to understand "concurrency"
  -> search(vault, "concurrency serializer mutex")
  -> rank candidate PKB notes and wiki pages
  -> backlinks(top hits) to find connected notes
  -> links(top hits) to inspect outgoing structure when needed
  -> properties()/outline()/readFile() only for shortlisted nodes
```

Search is the entrypoint. Edge traversal is the refinement step.

### Principle 2: Obsidian CLI is the vault boundary

For vault-visible content, the running Obsidian app is the source of truth.

That means:
- vault-wide search should use Obsidian CLI
- backlinks/orphans/deadends/unresolved should use Obsidian CLI
- vault-visible markdown/property reads and writes should prefer Obsidian CLI
- direct filesystem operations remain acceptable only for internal generated metadata and bootstrap state

Examples of allowed internal filesystem artifacts:
- `meta/registry.json`
- `meta/backlinks.json`
- `meta/index.md`
- `meta/log.md`
- `meta/lint-report.md`

These are internal extension artifacts, not the graph source of truth.

### Principle 3: Keep the internal wiki registry

This upgrade does **not** remove the wiki registry.

`registry.json` and wiki-local backlinks remain useful for:
- lifecycle metadata (`status`, `source_ids`, `consumed_at`, `pkb_refs`)
- deterministic wiki-only reports
- fast local rendering of wiki indexes and dashboards
- checks that are intentionally scoped to wiki structure rather than the full vault

The design boundary is:

```text
Obsidian CLI = vault graph truth
registry.json = extension-owned wiki state/cache
```

### Principle 4: Connect before writing

Any tool that creates or materially rewrites wiki knowledge should discover related PKB context first.

This rule belongs in tool handlers, not in skill prose only.

Required create/update flow:
1. derive candidate terms from title, summary, extracted source text, or page content
2. call a graph discovery helper
3. return or embed suggested PKB/wiki connections
4. write content with that context available to the agent

---

## 3. Current State Summary

The current code already provides a substantial foundation:
- `ObsidianClient.search()` exists but is not used by public tools
- `wiki_search` currently uses `search:context` scoped to `Wiki/`
- `rebuildRegistryAndIndex()` already enriches registry entries with external backlinks
- `wiki_lint` already uses CLI-native graph checks where available
- vault-visible reads/writes already go through `obsidian-io.ts` in several modules

The upgrade therefore is not a rewrite. It is an architectural promotion of capabilities that are already partially present.

---

## 4. Required Capability Additions

### 4.1 New graph helper module

Add a focused module, tentatively `extensions/brain-wiki/src/graph.ts`, responsible for vault-aware discovery.

Responsibilities:
- `findGraphContext()` -> discover and rank candidate wiki/PKB nodes
- `traverseNeighborhood()` -> fetch one-hop/two-hop context
- `bridgeWikiPage()` -> find likely missing PKB links for an existing wiki page
- `summarizeNode()` -> normalize properties, backlinks, and optional outline/body snippets

This module should depend on `ObsidianClient` and small parsing helpers only. It should not own writing behavior.

### 4.2 Extend `ObsidianClient`

The following methods are the first meaningful additions:
- `links(file)` for outgoing edges
- `outline(file, format?)` for heading-aware reads

Second-wave additions:
- `tags()`
- `tag(name)`
- `aliases()`

`search()` already exists and should be adopted before adding more complex APIs.

### 4.3 Extend `wiki_search`

Add:

```ts
scope: "wiki" | "vault"
```

Behavior:
- `scope="wiki"` keeps current behavior but should use a shared search path
- `scope="vault"` uses `client.search()` instead of `searchContext()` and returns mixed wiki/PKB results
- wiki hits can still be enriched from `registry.json`
- PKB hits should be enriched from CLI properties and path-derived zone metadata

This gives the system one stable public entrypoint for both local and vault-wide discovery.

### 4.4 Add graph-oriented public tools

New tools:
- `wiki_graph_find`
- `wiki_graph_traverse`
- `wiki_graph_bridge`

They should stay thin and delegate to `graph.ts`.

### 4.5 Enforce graph discovery in write paths

First targets:
- `wiki_capture_source`
- `wiki_ensure_page`

Desired behavior:
- run graph discovery before writing
- surface suggested related nodes in the tool result
- optionally seed a `## PKB Context` or `## Related Notes` section when appropriate

This should be additive at first. Do not force large body rewrites or opinionated templates in the first pass.

### 4.6 Tighten the vault-visible IO boundary

The project should explicitly converge on:

```text
vault-visible markdown/property operations -> Obsidian CLI
generated internal metadata -> filesystem
```

That means reviewing remaining direct `fs` fallbacks in:
- LIST workflows
- project notes workflows
- other modules that mutate files users see inside the vault

The goal is not "remove every filesystem call." The goal is "remove direct filesystem access for vault-visible user content when the CLI path exists."

---

## 5. Tool Design

### 5.1 `wiki_graph_find`

Purpose:
- discover what the vault already knows before creating or revising wiki knowledge

Input:
- `query?: string`
- `terms?: string[]`
- `sourceText?: string`
- `zones?: Array<"wiki" | "pkb">`
- `limit?: number`

Flow:
1. derive terms
2. run vault-wide search
3. rank candidate files
4. fetch properties/backlinks for top hits
5. optionally fetch outline or short body snippets for disambiguation

Output shape:
- ranked candidates
- grouped wiki vs PKB results
- suggested connection targets

### 5.2 `wiki_graph_traverse`

Purpose:
- inspect a node's neighborhood, primarily for review and research workflows

Input:
- `path: string`
- `hops?: 1 | 2`
- `includeOutgoing?: boolean`

Output:
- direct backlinks
- optional outgoing links
- second-hop aggregate counts when requested

### 5.3 `wiki_graph_bridge`

Purpose:
- find likely missing PKB or wiki connections for an existing wiki page

Input:
- `pagePath: string`
- `limit?: number`

Output:
- current links
- candidate related nodes
- likely missing connections
- short rationale per suggestion

---

## 6. Lint and Quality Model

`wiki_lint` should gain a `graph` mode, but it must stay scoped and deterministic.

Recommended checks:
- unresolved wikilinks via `unresolved()`
- orphaned notes via `orphans()`
- dead-end notes via `deadends()`
- wiki topic pages with zero PKB outbound links
- wiki topic pages with zero non-wiki inbound references

Not recommended for v1:
- subjective "good graph quality" scores
- aggressive auto-fixes
- cross-vault semantic judgments based only on backlinks count

Graph lint should answer:
- is the link graph mechanically healthy?
- are important wiki pages isolated from the PKB?

---

## 7. Phased Delivery

### Phase 1: Promote existing capability

Goal:
- expose vault-wide discovery without restructuring the whole extension

Scope:
- use `ObsidianClient.search()` in a new shared graph helper
- add `scope="vault"` to `wiki_search`
- keep registry-based enrichment for wiki results

Success criteria:
- agent can search across `Wiki/`, `Area/`, `Project/`, and `Resource/`
- users get mixed vault results without manual bash/grep work

### Phase 2: Add graph-native public tools

Scope:
- add `wiki_graph_find`
- add `wiki_graph_traverse`
- add `wiki_graph_bridge`

Success criteria:
- graph discovery is accessible as a stable public tool surface
- skills can route through these tools instead of asking the model to invent graph behavior

### Phase 3: Enforce connect-before-write

Scope:
- integrate graph discovery into `wiki_capture_source`
- integrate graph discovery into `wiki_ensure_page`

Success criteria:
- new wiki pages and captured summaries are created with explicit related-note context
- the agent stops writing in a vault vacuum

### Phase 4: Tighten IO boundary

Scope:
- audit remaining direct `fs` fallbacks for vault-visible content
- switch eligible LIST/project/user-visible writes to Obsidian-backed paths

Success criteria:
- user-visible vault mutations consistently flow through Obsidian CLI when available

### Phase 5: Second-wave graph APIs

Scope:
- add `links`, `outline`
- then evaluate `tags`, `tag`, and `aliases`

Success criteria:
- graph helper no longer needs avoidable markdown parsing for common discovery flows

---

## 8. Non-Goals

This design does not attempt to:
- remove `registry.json`
- replace every filesystem call in the extension
- build a separate graph database
- infer all semantics from graph structure alone
- rewrite all skills at once before the tool surface exists

---

## 9. Recommended Order

Recommended implementation order:
1. `wiki_search(scope="vault")`
2. `src/graph.ts`
3. `wiki_graph_find`
4. `wiki_graph_traverse`
5. `wiki_graph_bridge`
6. `wiki_capture_source` pre-write discovery
7. `wiki_ensure_page` pre-create discovery
8. `wiki_lint(mode="graph")`
9. remaining vault-visible IO audit

This sequence gives immediate product value early and avoids a speculative rewrite.
