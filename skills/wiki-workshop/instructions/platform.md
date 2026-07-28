# Phase 3 — Understand & Connect

Phase 3 is the core of supervised distillation. Between orienting to the wiki (Phase 2) and the Phase 4 questions, you build a **platform**: a shared conceptual frame that grounds you in the source and connects it to what Walker already knows. You are not filing — you are helping Walker extend their knowledge boundary.

This phase is **mandatory** for every ingest. Its depth scales with source weight (see `protocol.md`).

## Sub-steps

### 3.1 Ground yourself in the new content

Produce a concept-level synthesis of the source **for yourself**. Walker has already read it — this is your grounding, not a teaching block. Not a paraphrase. Not a filing. Model what the source actually says at the level of ideas:

- what claim or model the source advances
- what concepts it rests on
- what it adds that is genuinely new vs. confirmatory
- what its boundaries or tensions are

Output: an internal concept model, scoped to what the source genuinely contributes. It feeds 3.3 and the Phase 4 questions; it is not presented to Walker as content.

### 3.2 Search the PKB per the convention

Load `brain-wiki`'s `instructions/mini-search.md` (or confirm it is loaded). **Indexing the PKB scopes is a hard gate — not optional housekeeping.** If you skip `ctx_index`, the FTS5 store will not contain the PKB and `ctx_search` will return "No results found" for terms that genuinely exist in your notes; the platform will then be built from the wrong corpus. So:

1. Index all five PARA scopes per the recipe (`pkb-area`, `pkb-resource`, `pkb-draft`, `pkb-project`, `pkb-list`). Report file counts to confirm.
2. Run the **wrong-corpus sentinel** on the first `ctx_search` result: if you see a `::` source label, a `[current-session |` path, or `Wiki/No matches found.`, stop, re-index, and re-run.
3. Then query — **one `ctx_search` per scope, `source` always set** — using terms drawn from the explain block:
```
terms  = nouns + technical terms extracted from 3.1, 2-4 per query, batched per scope
scopes = one ctx_search per label: pkb-area (always), plus pkb-resource/pkb-draft/pkb-project when the source touches those shelves
limit  = 3 per query
```
Never omit `source`. The context-mode store is shared with web fetches and session memory; an unfiltered `ctx_search` surfaces non-PKB content and masquerades it as "what the user already knows."

Collect the matched windows with file paths and snippets. Do not read full PKB files unless a window is ambiguous and a follow-up `read` is needed to interpret it.

Output: a mental shelf of what Walker already knows that is relevant, each item cited by PKB path.

If `context-mode` is unavailable, degrade gracefully per the convention: build the platform from the wiki graph only and tell Walker.

### 3.3 Build the platform

Compose a bridging narrative with three explicit parts:

1. **What you already know** — the relevant PKB notes Walker holds, each tied to the source's terms. Cite paths.
2. **What is genuinely new** — the source's contribution that extends, refines, or contradicts the existing shelf.
3. **Where the edge is** — the tension, gap, or extension that is the actual knowledge-boundary opportunity. This is where Walker's boundary moves.

The platform is the scaffolding that lets Walker react from a shared frame, not from a raw source dump.

Output: a platform block, in teaching voice, with PKB citations and a clearly marked edge. Each distinct edge should be phrased as a concrete question or tension — it will become a frontmatter `edges:` entry (`id`, `text`, `state: open`, optional `targets`) and appear in the generated `meta/edges.md` learning frontier.

### 3.4 Compress the platform and derive questions

Compress the platform into a short frame (3-6 lines: known / new / edge) — this is what Walker sees in Phase 4. Then derive 2-5 probing questions from the edge. A good edge question:

- targets a tension between the source and a cited PKB entry, or
- asks what the source's claims imply for Walker's projects or notes, or
- asks what struck Walker and whether it matches the edge you identified, or
- opens an application or idea the source makes possible.

**Soft gate for additive sources.** **Hard gate** when any of these hold:

- the source **contradicts** any cited PKB entry or wiki topic
- the source implies a **new topic** not currently in the wiki
- the edge identified in 3.3 is genuinely ambiguous

On a hard gate, wait for Walker's input before Phase 4. On a soft gate, fold Walker's reactions into the Phase 4 discussion.

## Source-weight scaling

Depth scales so the protocol does not over-spend on trivial ingests. Always present, never skipped.

| Weight | Signal | Phase 3 depth |
|--------|--------|---------------|
| **Trivial** | one-line LIST.md note, tweet, single-sentence reference | single-sentence explain + scoped search (`pkb-area` only) + 2-3 line platform; no separate reaction gate, fold reaction into the Phase 4 discussion |
| **Substantial** | article chapter, paper section, blog post with a model | full 3.1-3.4 protocol |
| **Heavy** | full paper, book chapter, spec | full protocol plus multi-query PKB search and multiple platform drafts if Walker requests |

Classify weight at the end of Phase 1 (after reading the source) and announce it. Walker may override.

## Refinement without a new source

When the session is topic refinement rather than ingest, Phase 3 applies in a modified form:

- 3.1 becomes "explain what the topic currently claims"
- 3.2 searches the PKB for notes adjacent to the topic that have not yet been distilled
- 3.3 builds the platform as "what is already known but not yet synthesized into this topic"
- 3.4 compresses the platform and derives the Phase 4 questions

The absorption loop and supervision requirements remain.

## What the platform is NOT

- **Not disposable.** The platform starts as a conversational artifact, but it is persisted in Phase 5 as the `## Bridge` section of the summary page, with each edge recorded in frontmatter `edges:`. A platform that never reaches the page is a failed workshop.
- **Not a source summary.** The full summary page content is written in Phase 5. The Bridge is the bridge, not the record.
- **Not paraphrase.** 3.1 synthesizes at concept level; it must not restate the source verbatim.
- **Not autonomous.** The Phase 4 questions always put Walker in the conversation before any writing.