# Workshop Protocol

## Phase 0: Surface LIST.md Candidates

Before Walker provides a source, check LIST.md for unprocessed items:

```
1. Scan LIST.md for URLs that haven't been captured (no agent line linking to a source)
2. Scan for ideas or notes that could become wiki content
3. Present to Walker: "I see these items in LIST.md that look like source candidates: [list].
   Want me to capture any of them first? Or are you bringing something new?"
4. If Walker says yes, mark the item as [>] and proceed to Phase 1
5. If Walker says no, proceed with whatever they bring
```

## Phase 1: Receive Source

Walker provides a source (URL, file, or text). Can come directly or from LIST.md.

```
1. wiki_capture_source → creates inbox packet + summary stub
2. Read the extracted content → understand the source
3. Tell Walker: "Here's what I got from this source."
4. Classify the source weight (Trivial / Substantial / Heavy) per platform.md and announce it.
   Walker may override.
5. Append agent line to LIST.md under the item: "  A YYYY-MM-DDTHH:MM → Captured as SRC-ID"
6. If Walker initiated this session for a LIST.md item, toggle [ ] → [>] first, then [ ] → [x] on completion
```

## Phase 2: Orient to Existing Knowledge

Before building the platform, orient to what the wiki already knows.

```
1. Use wiki_search to find related topics
2. Use wiki_graph_find to surface nearby wiki and PKB nodes
3. Use wiki_graph_traverse or wiki_graph_bridge when a concrete target page exists
4. Read matching topic summaries and source pages → understand current state
5. Report to Walker: "Here's what we already know about [related areas] and the likely integration targets."
6. Identify: does this source add new information, contradict existing knowledge, or reinforce it?
```

## Phase 3: Understand & Connect

This is the supervised comprehension step. Build a shared conceptual platform before any takeaways are discussed. **Mandatory.** See `instructions/platform.md` for the full detail.

```
3.1 Explain the new content at concept level (teach, don't paraphrase)
3.2 Search the PKB per brain-wiki's instructions/mini-search.md
    - Load mini-search.md if not loaded; ensure PARA scopes indexed
    - ctx_search with terms drawn from 3.1, 2-4 per query, batched in one call
    - Collect windows with file paths; do not read full PKB files unless a window is ambiguous
3.3 Build the platform: "what you already know" + "what is genuinely new" + "where the edge is"
    - Cite PKB paths for every "what you already know" claim
3.4 Present the platform and invite Walker's reaction
    - Soft gate for additive sources
    - Hard gate if the source contradicts PKB/wiki, implies a new topic, or the edge is ambiguous
```

**Persist the platform.** The platform is not disposable chat output. In Phase 5 it becomes the `## Bridge` section of the summary page, and each edge identified in 3.3 becomes an entry in the page's frontmatter `edges:` list (`- id: edge-N, text: ..., state: open, targets: [...]`). `wiki_integrate_source` refuses to integrate a summary page that lacks them.

**Scaling:** Trivial sources use single-sentence explain + scoped `pkb-area` search + 2-3 line platform, and fold reaction into Phase 4. Substantial and Heavy sources run the full protocol.

**Hard gate:** if the source produced concrete integration targets in Phase 2, you must complete `wiki_graph_traverse` or `wiki_graph_bridge` and Phase 3 before editing any summary or topic page.

**Never skip Phase 3.** The whole point of the workshop is supervised distillation — building a shared frame before writing, not filing.

## Phase 4: Discuss Key Takeaways

Grounded in the platform, discuss what this source means for the wiki:

```
1. Present Walker with: "Here are the key takeaways I see from this source."
2. Present Integration Targets: "This source should affect these topic pages: [list]"
3. If the source is additive and the targets are clear, state the intended edits and continue to write.
4. If the source is contradictory, ambiguous, or implies a new topic, ask Walker for confirmation before writing.
   (These are the same hard-gate conditions from Phase 3.4 — resolve them here with Walker.)
```

**Hard gate:** if the source produced concrete integration targets, do not edit summary or topic pages until graph traversal or bridging (Phase 2) and the platform (Phase 3) are complete.

## Phase 5: Write

After the takeaways and targets are clear, and after confirmation only when needed:

```
1. Write or update the summary page (full content), including:
   - `## Bridge` section — the platform from Phase 3 (already known / genuinely new / where the edge is), with PKB citations
   - frontmatter `edges:` — one entry per knowledge-boundary question: id, text, state (open|exploring), optional targets, created date
   - `## Integration targets` — concrete page links, no `[[topics/...]]` placeholders
2. Use wiki_ensure_page before creating any new topic
3. Update each Integration Target topic page
   - Re-read the topic first (absorption loop!)
   - Add new information with source citations
   - Apply anti-cramming: if a sub-topic is growing, propose a new page
   - Apply anti-thinning: every edit adds real substance
4. Set summary status to "integrated" via wiki_integrate_source (it validates Bridge, edges, and Integration targets)
5. wiki_log_event kind=integrate
6. Append agent line to LIST.md: "  A YYYY-MM-DDTHH:MM → Integrated into [[topics/...]]"
7. Toggle the LIST.md item [ ] → [x] if this session was prompted by a LIST.md source
```

---

## Topic Refinement (Without New Source)

Walker may also start a workshop session to refine an existing topic without a new source:

1. Re-read the topic page
2. Re-read the summary pages that informed it (check `source_ids` in frontmatter)
3. Run Phase 2 (orient to wiki) and Phase 3 (Understand & Connect) in modified form:
   - 3.1 becomes "explain what the topic currently claims"
   - 3.2 searches the PKB for adjacent notes not yet distilled into this topic
   - 3.3 builds the platform as "what is already known but not yet synthesized into this topic"
4. Discuss improvements with Walker (Phase 4)
5. Get Walker confirmation
6. Apply edits (Phase 5)
7. `wiki_log_event kind=refactor`

This is the same protocol minus the capture step. The absorption loop, Phase 3, and supervision requirements all still apply.

---

## Graduation Mode (wiki → PKB)

When Walker has internalized wiki knowledge and wants it reflected in their PKB, switch to graduation mode: compare the wiki source against PKB entries **against the page's open edges**, propose PKB edits, close resolved edges in frontmatter, and mark the page consumed. See `instructions/graduation.md`.