# Source Processing Checklist

When processing a new source, complete ALL of these steps:

- [ ] `wiki_capture_source` → inbox packet created
- [ ] Read extracted content → ground yourself (Walker has read it; no report-back)
- [ ] Classify source weight (Trivial / Substantial / Heavy); announce it; Walker may override
- [ ] Append agent line to LIST.md under the item
- [ ] **Phase 2 — Orient:**
- [ ] `wiki_search` → find related topics and summaries
- [ ] `wiki_graph_find` → surface nearby wiki and PKB nodes
- [ ] `wiki_graph_traverse` or `wiki_graph_bridge` → concrete neighbors when available
- [ ] Report current wiki state and likely integration targets to Walker
- [ ] **Phase 3 — Understand & Connect (mandatory):**
- [ ] 3.1 Ground yourself in the source at concept level (internal)
- [ ] 3.2 Load `brain-wiki/instructions/mini-search.md`; ensure PARA scopes indexed per its recipe
- [ ] 3.2 `ctx_search` with terms from 3.1 (2-4 per query, batched in one call; scope per source weight)
- [ ] 3.3 Build the platform: what you already know (cite PKB paths) + what is genuinely new + where the edge is
- [ ] 3.4 Compress the platform to 3-6 lines; derive the Phase 4 questions
- [ ] If concrete targets exist, do not edit summary/topic pages until graph traversal/bridging and Phase 3 are complete
- [ ] **Phase 4 — Questions & Brainstorm:**
- [ ] Present the compressed platform (3-6 lines: known / new / edge)
- [ ] Ask 2-5 edge-focused questions
- [ ] Discuss Walker's answers; refine the Bridge; capture ideas
- [ ] Present Integration Targets
- [ ] Hard gate: contradictory / new-topic / ambiguous → wait for Walker
- [ ] **Phase 5 — Write:**
- [ ] Write/update summary page (learning record), including:
- [ ] `## Core claim` — 2-3 sentences on the source's single claim or model
- [ ] `## Bridge` section — the platform refined by Phase 4, with PKB citations
- [ ] `## Discussion` section — questions asked, Walker's compressed answers, ideas
- [ ] frontmatter `edges:` — one entry per knowledge-boundary question (id, text, state, targets, created)
- [ ] `## Integration targets` — concrete page links, no `[[topics/...]]` placeholders
- [ ] `wiki_ensure_page` for any new topics (concrete noun test!)
- [ ] Re-read each target topic → then update it
- [ ] Apply anti-cramming (split if growing) and anti-thinning (add real substance)
- [ ] Set summary status to `integrated` via `wiki_integrate_source` (validates Bridge + edges + targets)
- [ ] `wiki_log_event kind=integrate`
- [ ] Append agent line to LIST.md: "  A YYYY-MM-DDTHH:MM → Integrated into [[topics/...]]"
- [ ] Toggle the LIST.md item [ ] → [x] if this session was prompted by a LIST.md source